function parseVoxFile(voxArrayBuffer) {
    var vox = Object.create(parseVoxFile.api);
    var offset = 0;
    var voxView = new DataView(voxArrayBuffer);
    { // check magic number
        var magicNumberError = new Error('wrong magic number');
        if (voxView.getUint8(offset++) !== 'V'.charCodeAt()) throw magicNumberError;
        if (voxView.getUint8(offset++) !== 'O'.charCodeAt()) throw magicNumberError;
        if (voxView.getUint8(offset++) !== 'X'.charCodeAt()) throw magicNumberError;
        if (voxView.getUint8(offset++) !== ' '.charCodeAt()) throw magicNumberError;
    }
    { // version number
        var versionNumberView = new DataView(voxArrayBuffer, offset, 4);
        offset += 4;
        var versionNumber = versionNumberView.getUint32(0, true);
        vox.version = versionNumber;
    }
    { // main chunk
        vox.main = parseVoxFile.readChildren(
            new DataView(voxArrayBuffer, offset)
        )[0];
    }
    return vox;
}
parseVoxFile.readChildren = function readChildren(chunkView, parent) {
    var children = [];
    var buffer = chunkView.buffer;
    var length = chunkView.byteLength;
    var offset = 0;
    while (offset < length) {
        var chunk = {};
        { // read header
            var chunkId = [
                chunkView.getUint8(offset++),
                chunkView.getUint8(offset++),
                chunkView.getUint8(offset++),
                chunkView.getUint8(offset++)
            ].map(function (idChar) {
                return String.fromCharCode(idChar);
            }).join('');
            var chunkIndex = children[chunkId] || [];
            chunkIndex.push(children.length);
            children[chunkId] = chunkIndex;
            chunk.id = chunkId;
            var contentLength = chunkView.getUint32(offset, true);
            offset += 4;
            var childrenLength = chunkView.getUint32(offset, true);
            offset += 4;
        }
        { // read chunk content
            chunk.content = new DataView(
                buffer,
                chunkView.byteOffset + offset,
                contentLength
            );
            offset += contentLength;
        }
        { // read children
            chunk.children = parseVoxFile.readChildren(new DataView(
                buffer,
                chunkView.byteOffset + offset,
                childrenLength
            ), chunk.id);
            offset += childrenLength;
        }
        children.push(chunk);
    }
    return children;
};
parseVoxFile.api = {
    get width() { // x size
        return this.chunk('SIZE').content.getUint32(0, true);
    },
    get height() { // y size
        return this.chunk('SIZE').content.getUint32(4, true);
    },
    get length() { // z size
        return this.chunk('SIZE').content.getUint32(8, true);
    },
    get count() { // the number of voxel
        return this.chunk('XYZI').content.getUint32(0, true);
    },
    get xyzis() {
        var xyzis = [];
        var view = this.chunk('XYZI').content;
        var len = view.byteLength;
        var offset = 4;
        while (offset < len) {
            xyzis.push({
                x: view.getUint8(offset++),
                y: view.getUint8(offset++),
                z: view.getUint8(offset++),
                i: view.getUint8(offset++)
            });
        }
        return xyzis;
    },
    defaultColor: 0xABCDEF,
    get colors() {
        var colors = [];
        var RGBA = this.chunk('RGBA');
        if (RGBA) {
            var view = RGBA.content;
            var len = view.byteLength;
            var offset = 0;
            while (offset < len) {
                var r = view.getUint8(offset++);
                var g = view.getUint8(offset++);
                var b = view.getUint8(offset++);
                var a = view.getUint8(offset++);
                colors.push((r << 16) | (g << 8) | b);
            }
            return colors;
        } else {
            for (var i = 0; i < 256; ++i)
                colors.push(this.defaultColor);
            return colors;
        }
    },
    chunk: function (id) {
        var children = this.main.children;
        var index = children[id];
        return index ? children[index[0]] : undefined;
    }
};

function vox2union(vox, name, option) {
    var union = {};
    var opt = {
        fixCoord: option.fixCoord === undefined ? true : !!option.fixCoord,
        centerXZ: option.centerXZ === undefined ? true : !!option.centerXZ,
        centerY: option.centerY === undefined ? false : !!option.centerY
    };
    union.name = name;
    {
        var width = vox.width;
        var height = vox.height;
        var length = vox.length;
        if (opt.fixCoord) {
            var temp = height;
            height = length;
            length = height;
        }
        var halfWidth = width >> 1;
        var halfHeight = height >> 1;
        var halfLength = length >> 1;
        var xyzis = vox.xyzis;
        var palette = vox.colors;
    }
    union.blockList = xyzis.map(function (xyzi) {
        var x, y, z;
        if (opt.fixCoord) {
            x = xyzi.x;
            y = xyzi.z;
            z = length - xyzi.y;
        } else {
            x = xyzi.x;
            y = xyzi.y;
            z = xyzi.z;
        }
        if (opt.centerXZ) {
            x = x - halfWidth;
            z = z - halfLength;
        }
        if (opt.centerY) {
            y = y - halfHeight;
        }
        var color = palette[xyzi.i];
        return {
            position: [x, y, z],
            color: color
        };
    });
    union.unionList = [];
    return union;
}

if (typeof window === 'undefined' && typeof exports !== 'undefined') { // for node.js
    exports.parseVoxFile = parseVoxFile;
    exports.vox2union = vox2union;
}
