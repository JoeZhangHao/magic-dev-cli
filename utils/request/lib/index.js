'use strict';

const axios = require('axios');

const BASE_URL = process.env.MAGIC_CLI_BASE_URL ? process.env.MAGIC_CLI_BASE_URL : 'http://magic.cli.xyz:7001';

const request = axios.create({
	baseURL: BASE_URL,
	timeout: 5000
});

request.interceptors.response.use(
	response => {
		if (response.status === 200) {
			return response.data;
		} else {
			return null;
		}
	},
	error => {
		return Promise.reject(error);
	}
)

request.interceptors.request.use()

module.exports = request;
