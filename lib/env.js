'use strict';
const path=require('node:path'), fs=require('node:fs');
const envPath=path.join(__dirname,'..','.env');
if(fs.existsSync(envPath)&&typeof process.loadEnvFile==='function') process.loadEnvFile(envPath);
