'use strict';

const axios = require('axios');
const urlJoin = require('url-join');
const semver = require('semver');

function getNpmInfo(npmName, registry) {
	if (!npmName) {
		return null;
	}
	const registryUrl = registry || getDefaultRegistry();
	const npmInfoUrl = urlJoin(registryUrl, npmName);

	// 调用 npm 接口，请求对应包名的信息
	return axios.get(npmInfoUrl).then(response => {
		if (response.status === 200) {
			return response.data;
		}

		return null;
	}).catch((err) => {
		return Promise.reject(err);
	})
}

function getDefaultRegistry(isOriginal = false) {
	return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobao.org'
}

async function getNpmVersion(npmName, registry) {
	const data = await getNpmInfo(npmName, registry);
	if (data) {
		return Object.keys(data.versions);
	} else {
		return [];
	}
}

function getSemverVersions(baseVersion, versions) {
	return versions
	.filter((version) => semver.satisfies(version, `^${baseVersion}`))
	.sort((a, b) => semver.gt(b, a));
}

async function getNpmSemverVersion(baseVersion, npmName, registry) {
	const versions = await getNpmVersion(npmName, registry);
	const newVersions = getSemverVersions(baseVersion, versions);
	if (newVersions && newVersions.length > 0) {
		return newVersions[0];
	}

	return null;
}

// 获取 npm 包最新的版本号
async function getNpmLatestVersion(npmName, registry) {
	const versions = await getNpmVersion(npmName, registry);
	if (versions) {
		return versions.sort((a, b) => semver.gt(b, a))[0];
	}
	return null;
}

module.exports = {
	getNpmInfo,
	getNpmVersion,
	getNpmSemverVersion,
	getDefaultRegistry,
	getNpmLatestVersion
};