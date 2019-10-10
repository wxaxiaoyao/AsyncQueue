const _fs = require("fs");
const _path = require("path");

const util = {};

// 递归创建目录
util.mkdir = (path) => {
	if (!path || path == ".." || path == "." || path == _path.sep || _fs.existsSync(path)) return false;
	
	try {
		_fs.mkdirSync(path);  // 创建目录
		return true;
	} catch(e) {
		if (e.code === "EEXIST") return false;
		if (e.code !== "ENOENT") return false;

		// 子目录不存在 创建子目录
		util.mkdir(_path.dirname(path));           
		
		// 重新创建目录, 使用系统接口避免死循环
		try {
			_fs.mkdirSync(path);                   
			return true;
		} catch(e) {
			return false;
		}
	}
}

// 递归删除目录
util.rmdir = (path) => {
	try {
		if (_fs.existsSync(path)) {
			if (_fs.statSync(path).isDirectory()) {
				_fs.readdirSync(path).forEach(file => {
					const subpath = _path.join(path, file);
					if(_fs.statSync(subpath).isDirectory()){
						//递归删除文件夹
						if (!util.rmdir(subpath)) return false; 
					} else {
						//删除文件
						_fs.unlinkSync(subpath); 
					}
				});
				_fs.rmdirSync(path);
			} else {
				_fs.unlinkSync(path);
			}
		}
	} catch(e) {
		return false;
	}

	return true;
}

// promise wrap
util.promiseTry = (fn) => {
	try {
		return Promise.resolve(fn());
	} catch(e) {
		return Promise.reject(e);
	}
}

module.exports = util;
