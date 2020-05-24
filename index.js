#!/usr/bin/env node

const figlet = require('figlet');
const chalk = require('chalk');

const args = process.argv.slice(2);
const library = require('./src');

const init = async (args) => {
  if ( args.length < 1 ) {
    console.warn("invalid number of arguments provided..");
    return;
  }

  let func = args[0];
  if ( !library.hasOwnProperty(func) ) {
    throw Error("Invalid function provided");
  }

  await library[func](...args.slice(1));
};

init(args)
  .then(_ => {
    console.log(
      chalk.red(
        figlet.textSync('Your keys, your money!', {
          font: 'Ghost',
          horizontalLayout: 'full'
        })
      )
    );
  })
  .catch(err => console.warn(err));