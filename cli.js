#!/usr/bin/env node

var fs = require('fs');

process.title = 'vox2union';

var nomnom = require('nomnom');
nomnom.script('vox2union');
nomnom.options({
    file: {
        required: true,
        position: 0,
        help: 'vox file'
    },
    help: {
        abbr: 'h',
        flag: true,
        help: 'print this message'
    }
});
var opts = nomnom.parse();
var filePath = opts.file;
var fileBuffer;

try {
    fileBuffer = fs.readFileSync(filePath);
} catch (e) {
    switch (e.errno) {
    case 34:
        process.stderr.write(filePath + ': no such file or directory');
        process.exit(2);
        break;
    default:
        process.stderr.write(e.message);
        process.exit(1);
        break;
    }
}

var v2u = require('./vox2union');

var voxArrayBuffer = (function () {
    var voxArrayBuffer = new ArrayBuffer(fileBuffer.length);
    var fileView = new Uint8Array(voxArrayBuffer);
    var len = fileBuffer.length;
    for (var i = 0; i < len; ++i)
        fileView[i] = fileBuffer[i];
    return voxArrayBuffer;
})();

var vox = v2u.parseVoxFile(voxArrayBuffer);
process.stdout.write(JSON.stringify(v2u.vox2union(vox, filePath)));
