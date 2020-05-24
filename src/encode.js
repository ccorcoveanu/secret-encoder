const fs = require('fs');
const qr = require('qrcode');
const scryptsy = require('scryptsy');
const crypto = require('crypto');
const jimp = require('jimp');
const inquirer = require('inquirer');
const zlib = require('zlib');
const { TEMP_FILE } = require('./constants');

const questions = [
  {
    name: 'password',
    type: 'password',
    message: 'Enter a password to encrypt your file:',
    validate: function(value) {
      if (value.length) {
        return true;
      } else {
        return 'Please enter your password.';
      }
    }
  }
];


const encode = async (secret, output) => {
  if ( !secret ) {
    throw Error("No secret file provided");
  }
  if ( !output ) {
    output = './source/qr.jpg'
  }

  const {password} = await inquirer.prompt(questions);
  // parse json first to remove unnecesary newline and space characters
  let secretFile = JSON.parse(
    fs.readFileSync(secret).toString()
  );
  secretFile = Buffer.from(JSON.stringify(secretFile));
  // Now compress content
  secretFile = zlib.deflateSync(secretFile);

  let finalSecretContent = Buffer.from(JSON.stringify(
    encryptContent(secretFile, password)
  ));
  finalSecretContent = zlib.deflateSync(finalSecretContent);

  let pixelLen = Math.ceil(finalSecretContent.length/2);
  let matrixDimension = Math.ceil(Math.sqrt(pixelLen));

  // TODO: result from this function should be used directly without saving temp file,
  //  but for now I can't tell how to make jimp return the WHOLE jpeg file data
  //  not just pixel data
  saveTempJPG(finalSecretContent, matrixDimension, () => {
    let tempFileContent = fs.readFileSync(TEMP_FILE);
    if ( !tempFileContent ) {
      throw Error("Concurency shit?! Donno if image.write() is async or not yet");
    }
    qr.toFile(
      output,
      [
        {
          data: tempFileContent,
          mode: 'byte'
        }
      ],
      //{errorCorrectionLevel: 'L'}
    );
  });
};

function encryptContent(secretContent, password) {
  const salt = crypto.randomBytes(32);
  const kdParams = {
    dklen: 32,
    salt: salt.toString('hex'),
    n: 4096,
    r: 8,
    p: 1,
  };
  const iv = crypto.randomBytes(16);
  const derivedKey = scryptsy(Buffer.from(password), salt, kdParams.n, kdParams.r, kdParams.p, kdParams.dklen);

  const cipher = crypto.createCipheriv('aes-128-ctr', derivedKey.slice(0, 16), iv);
  const ciphertext = Buffer.concat([cipher.update(secretContent), cipher.final()]);

  const mac = crypto.createHmac('sha256', derivedKey.slice(16, 32))
    .update(ciphertext)
    .digest();

  return {
    ciphertext: ciphertext.toString('hex'),
    cipherparams: {
      iv: iv.toString('hex')
    },
    cipher: 'aes-128-ctr',
    kdf: 'scrypt',
    kdfparams: kdParams,
    mac: mac.toString('hex'),
  }
}

function saveTempJPG(mySecretToEmbed, matrixDimension, cb) {
  return new jimp(matrixDimension, matrixDimension, 255, (err, image) => {
    if ( err ) {
      throw err;
    }

    let mockIntensityIndex = 0; // shoud be between 0 and 2
    for ( let y = 0; y < image.bitmap.height; y++ ) {
      for ( let x = 0; x < image.bitmap.width; x++ ) {
        let currentIteration = image.bitmap.width * y + x;
        let imageDataCurrentIndex = currentIteration << 2;
        let dataIndexStart = currentIteration << 1;

        let c1 = 255, c2 = 255,
          cMock = Math.floor(Math.random() * 254) + 2; // number between 2-255, we let 0 and 1 for pixels that are misshing data

        if ( dataIndexStart === mySecretToEmbed.length-1 ) {
          cMock = 1;
          c1 = mySecretToEmbed[dataIndexStart];
          c2 = Math.floor(Math.random() * 256);
        } else if ( dataIndexStart >= mySecretToEmbed.length ) {
          cMock = 0;
          c1 = Math.floor(Math.random() * 256);
          c2 = Math.floor(Math.random() * 256);
        } else {
          c1 = mySecretToEmbed[dataIndexStart];
          c2 = mySecretToEmbed[dataIndexStart+1];
        }

        image.bitmap.data[imageDataCurrentIndex+mockIntensityIndex] = cMock;
        switch (mockIntensityIndex) {
          case 0:
            image.bitmap.data[imageDataCurrentIndex+1] = c1;
            image.bitmap.data[imageDataCurrentIndex+2] = c2;
            break;

          case 1:
            image.bitmap.data[imageDataCurrentIndex] = c1;
            image.bitmap.data[imageDataCurrentIndex+2] = c2;
            break;

          case 2:
            image.bitmap.data[imageDataCurrentIndex] = c1;
            image.bitmap.data[imageDataCurrentIndex+1] = c2;
            break;

          default: throw Error("Error calculating mockIntensityIndex");
        }

        mockIntensityIndex = (mockIntensityIndex + 1)%3;
      }
    }

    let x = image.quality(100).write(TEMP_FILE, cb);
    console.log(image.bitmap.data);
  });
}

module.exports = encode;