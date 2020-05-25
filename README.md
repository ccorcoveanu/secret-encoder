# Secret QR code encoder

This is a small tool I wrote for myself to keep some secrets in form of a qr code. <br/>
This makes the secret data printable and **not in text format** which is usefull for when you have it laying around.<br/>
The second catch is that the qr code will actually contain data of another PNG image where the pixels will contain the 
actual encrypted data. It would have been usefull if QR code scanning apps would actually detect the type of data in 
the QR code but since the capacity is small, all of them assume text and don't bother parsing anything else. <br/>
In any case it was fun experimenting and I still consider it another small obfuscation layer.

## How to use

```
$ git clone https://github.com/ccorcoveanu/secret-encoder.git && cd secret-encoder
$ npm install -g
$ secrets encode /path/to/secrets/file /path/to/resulting/qr/code
$ secrets decode /path/to/qr/code /path/to/new/plain/data/file
```

Note that encode/decode prompts for a password that will be used in encrypting/decrypting the data so **DO NOT FORGET IT**

## TODOS

 - Unit tests
 - Define a structure of the encoded data and add functionalities for add/remove - useful for how I am using it where 
 the data is a json containing wallets and node keys. Then we could have: `$ secrets add-wallet` and stuff like this
 - Ask to repeat password
 - Prettier user prints and a help menu maybe
 - Find out how to use jimp resulting image and pipe that into the qr code instead of writing the temp file on disk
 - Find a way for the temp file to be jpeg by default so it will not have an alpha channel. This currently increases 
 the data size that needs to be put in the qr code and it is not of any use.
