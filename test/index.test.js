
const _ =  require("lodash");
const assert = require("assert");

const AsyncQueue = require("../index.js");

const sleep = async (ms = 0) => {
	return new Promise((resolve, reject) => {
		return setTimeout(resolve(true), ms);
	})
}

describe("async queue", async () => {
	it("001 优先级测试", async () => {
		const p1 = async () => {
			return await new Promise((resolve, reject) => {
				setTimeout(() => {
					console.log("wait 1s, p1");
					return resolve("p1");
				}, 1000);
			});
		}

		const p2 = async () => {
			return await new Promise((resolve, reject) => {
				setTimeout(() => {
					console.log("wait 2s, p2");
					return resolve("p2");
				}, 2000);
			});
		}

		const p3 = async () => {
			return await new Promise((resolve, reject) => {
				setTimeout(() => {
					console.log("wait 3s, p3");
					return resolve("p3");
				}, 3000);
			});
		}

		AsyncQueue.exec("", p1, {priority: 10});
		AsyncQueue.exec("", () => {console.log("wait 0s, p0")}, {priority: 12});
		AsyncQueue.exec("", p2, {priority: 11});
		AsyncQueue.exec("", p3, {priority: 9});
		await sleep(6000);
		
	});

	it ("002 计数测试", async () => {
		let total = 0;
		const countTask = async () => {
			let count = total;
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					total = count + 1;
					console.log("total: ", total);
					return resolve(total);
				}, _.random(500, 2000));
			})
		}

		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));
		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));
		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));
		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));
		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));
		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));
		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));
		setTimeout(() => AsyncQueue.exec("", countTask), _.random(100, 1500));

		// 等待
		await new Promise((resolve, reject) => {
			setTimeout(async () => {
				await AsyncQueue.exec("", countTask);
				resolve(true);
			}, 5000);
		});
	});
});
