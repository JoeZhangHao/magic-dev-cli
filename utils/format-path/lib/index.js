'use strict';

const path = require('path');

function formatPath(path) {
	if (path) {
		const sep = path.sep;
		if (sep === '/') {
			return path;
		} else {
			// 针对 windows 系统路径的兼容
			return path.replace(/\\/g, '/');
		}
	}
	
	return path;
}

module.exports = formatPath;