const _fs = require("fs");
const _path = require("path");

const util = {};

util.mkdir = (path) => {
	if (!path || path == ".." || path == "." || path == _path.sep || _fs.existsSync(path)) return false;
	const dir = _path.dirname(path);
	
	try {
		_fs.mkdirSync(path);  // 创建目录
		return true;
	} catch(e) {
		if (e.code === "EEXIST") return false;
		if (e.code !== "ENOENT") throw e;
		util.mkdir(dir);           // 目录不存在 创建子目录
		return util.mkdir(path);          // 重新创建父目录
	}
}

util.rmdir = (path) => {
	try {
		_fs.rmdirSync(path);
		return true;
	} catch(e) {
		return false;
	}
}

util.promiseTry = (fn) => {
	try {
		return Promise.resolve(fn());
	} catch(e) {
		return Promise.reject(e);
	}
}

module.exports = util;
