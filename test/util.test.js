const _ =  require("lodash");
const assert = require("assert");

const util = require("../lib/util.js");

describe("util", async () => {
	it("dir", async () => {
		const dirname = "./test/lock/lock/lock";
		util.mkdir(dirname);
		util.rmdir(dirname);
	});
})
