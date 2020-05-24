const fs = require('fs');
const jimp = require('jimp');
const jsQR = require("jsqr");
const scryptsy = require('scryptsy');
const crypto = require('crypto');
const zlib = require('zlib');
const inquirer = require('inquirer');

const questions = [
  {
    name: 'password',
    type: 'password',
    message: 'Enter a password to decrypt your file:',
    validate: function(value) {
      if (value.length) {
        return true;
      } else {
        return 'Please enter your password.';
      }
    }
  }
];

const decode = async (file, output) => {
  if ( !file ) {
    throw Error("No encoded file provided");
  }
  if ( !output ) {
    output = './output/decoded-secrets.json'
  }

  const {password} = await inquirer.prompt(questions);
  let qrImg = await jimp.read(fs.readFileSync(file));
  if ( !qrImg ) {
    throw Error("Invalid image file provided");
  }

  const code = jsQR(qrImg.bitmap.data, qrImg.bitmap.width, qrImg.bitmap.height);

  let dataImg = await jimp.read(Buffer.from(code.binaryData));
  let encryptedData =
    JSON.parse(
      zlib.inflateSync(
        Buffer.from(extractEncryptedData(dataImg))
      ) .toString()
    );
  let plainData =
    JSON.parse(
      zlib.inflateSync(decryptData(encryptedData, password))
        .toString()
  );

  fs.writeFileSync(output, JSON.stringify(plainData, null, 2));
};

function extractEncryptedData(dataImg) {
  let encryptedData = [];
  let mockIntensityIndex = 0; // shoud be between 0 and 2

  for ( let y = 0; y < dataImg.bitmap.height; y++ ) {
    for (let x = 0; x < dataImg.bitmap.width; x++) {
      let currentIteration = dataImg.bitmap.width * y + x;
      let imageDataCurrentIndex = currentIteration << 2;

      let d1, d2;
      switch (mockIntensityIndex) {
        case 0:
          d1 = dataImg.bitmap.data[imageDataCurrentIndex + 1];
          d2 = dataImg.bitmap.data[imageDataCurrentIndex + 2];
          break;
        case 1:
          d1 = dataImg.bitmap.data[imageDataCurrentIndex];
          d2 = dataImg.bitmap.data[imageDataCurrentIndex + 2];
          break;
        case 2:
          d1 = dataImg.bitmap.data[imageDataCurrentIndex];
          d2 = dataImg.bitmap.data[imageDataCurrentIndex + 1];
          break;

        default: throw Error("Error calculating mockIntensityIndex");
      }

      if ( dataImg.bitmap.data[imageDataCurrentIndex+mockIntensityIndex] > 1 ) {
        encryptedData.push(d1);
        encryptedData.push(d2);
      } else if ( dataImg.bitmap.data[imageDataCurrentIndex+mockIntensityIndex] === 1 ) {
        encryptedData.push(d1);
      }

      mockIntensityIndex = (mockIntensityIndex + 1)%3;
    }
  }

  return encryptedData;
}

function decryptData(encryptedData, password) {
  const {kdfparams} = encryptedData;
  const derivedKey = scryptsy(Buffer.from(password),
    Buffer.from(kdfparams.salt, 'hex'), kdfparams.n, kdfparams.r, kdfparams.p, kdfparams.dklen);

  const ciphertext = Buffer.from(encryptedData.ciphertext, 'hex');

  const mac = crypto.createHmac('sha256', derivedKey.slice(16, 32))
    .update(ciphertext)
    .digest();

  if ( mac.toString('hex') !== encryptedData.mac ) {
    throw new Error('MAC mismatch, possibly wrong password');
  }

  const decipher = crypto.createDecipheriv(encryptedData.cipher, derivedKey.slice(0, 16),
    Buffer.from(encryptedData.cipherparams.iv, 'hex'));

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = decode;