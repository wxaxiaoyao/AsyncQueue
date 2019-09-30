const _fs = require("fs");
const _path = require("path");
const base64 = require('js-base64').Base64;
const _ = require("lodash");

const promiseTry = (fn) => {
	try {
		return Promise.resolve(fn());
	} catch(e) {
		return Promise.reject(e);
	}
}

const mkdir = (path) => {
	if (!path || _fs.existsSync(path)) return;

	const dir = _path.dirname(path);
	if (dir == path) throw new Error("create dir failed");
	
	try {
		_fs.mkdirSync(path);  // 创建目录
	} catch(e) {
		if (e.code !== "ENOENT") throw e;
		mkdir(dir);           // 目录不存在 创建子目录
		mkdir(path);          // 重新创建父目录
	}
}

const QUEUES_VAR = Symbol("QUEUES_VAR");
const QUEUE_FN = Symbol("QUEUE_FN");
const DONE_FN = Symbol("DONE_FN");
const EXEC_FN = Symbol("EXEC_FN");
const TASK_FN = Symbol("TASK_FN");
const LOCK_FN = Symbol("LOCK_FN");
const UNLOCK_FN = Symbol("UNLOCK_FN");

class AsyncQueue {
	constructor(opts = {}) {
		this[QUEUES_VAR] = {};
		this.maxSize = opts.maxSize || 0;        // 不做限制
		this.timeout = opts.timeout || 0;        // 默认超时时间
		this.enableFileLock = false;             // 是否启用文件锁
		this.fileLockDir = "";                   // 文件锁目录
	}

	// 使用目录锁
	async [LOCK_FN](dirname, timeout = 0) {
		const startTime = _.now();
		return new Promise((resolve, reject) => {
			const _lock = () => {
				try {
					_fs.mkdirSync(dirname, {recursive: true});
					console.log("-----------------");
					return resolve(true);
				} catch(e) {
					console.log(e);
					if (timeout && (_.now() - startTime) > timeout) return resolve(false);
					console.log("仓库被锁定, 等待解锁");
					setTimeout(_lock, 100);
				} 
			}
			return _lock();
		});
	}

	[UNLOCK_FN](dirname) {
		_fs.rmdirSync(dirname, {recursive: true});
		//_fs.rmdirSync(dirname);
	}

	// 获取队列
	[QUEUE_FN](key) {
		// 创建任务队列
		this[QUEUES_VAR][key] = this[QUEUES_VAR][key] || {
			task: undefined,                  // 当前任务
			tasks: [],                        // 任务列表
			maxSize: 0,                       // 队列最大任务数
		};

		return this[QUEUES_VAR][key];
	}

	// 任务执行完成
	[DONE_FN](task, data, err) {
		// 返回执行结果
		if (err) {
			task.reject(err);
		} else {
			task.resolve(data);
		}

		// 任务队列
		const queue = task.queue;

		// 移除执行任务
		_.remove(queue.tasks, o => o.id === task.id);

		// 当前任务执行完, 则执行下一个任务
		if (task.id === queue.task.id) {
			const nextTask = queue.tasks.shift();
			if (nextTask) {
				this[EXEC_FN](nextTask);
			} else {
				queue.task = undefined;
				//this[QUEUES_VAR][task.key] = undefined;
			}
		}
	}

	// 执行任务
	async [EXEC_FN](task) {
		// 设置当前正在执行的任务
		task.queue.task = task;

		const queue = task.queue;
		const key = task.key;
		const fileLockDir = this.fileLockDir || "";
		const base64Key = base64.encode(task.key);
		const dirname = _path.join(fileLockDir, "lock~" + base64Key);
		const ok = await this[LOCK_FN](dirname, task.timeout || queue.timeout || this.timeout);
		if (!ok) return this[DONE_FN](task, undefined, new Error(`${key} lock failed`));

		// 执行任务
		promiseTry(() => {
			return task.fn();
		}).then(data => {
			this[UNLOCK_FN](dirname);
			this[DONE_FN](task, data, undefined);
		}).catch(err => {
			this[UNLOCK_FN](dirname);
			this[DONE_FN](task, undefined, err);
		});
	}

	[TASK_FN](key, fn, opts) {
		const queue = this[QUEUE_FN](key);            // 当前资源队列
		
		const maxSize = opts.maxSize || queue.maxSize || this.maxSize;

		if (maxSize && queue.length >= maxSize) throw new Error("task exceeds maximum limit");

		// 初始化任务
		const task = {
			id: Symbol("task"),                       // 任务id
			queue,                                    // 任务所在队列
			key,                                      // 任务资源类型
			fn,                                       // 任务执行函数
			priority: opts.priority || 1000,          // 优先级 越小优先级越高
			timeout: opts.timeout || 0,               // 超时时间
			//resolved: false,
			resolve: undefined,
			reject: undefined,
		}
	
		// 添加任务
		queue.tasks.push(task);
		queue.tasks = _.orderBy(queue.tasks, ['priority', 'asc']);

		// 超时
		if (task.timeout) {
			setTimeout(() => {
				this[DONE_FN](task, undefined, new Error("task timeout"));
			}, task.timeout);
		}

		return task;
	}

	async exec(key, fn, opts = {}) {
		if (typeof(fn) !== 'function') throw new Error("You must pass a function to execute");

		const task = this[TASK_FN](key, fn, opts);

		// 当前promise
		const promise = new Promise((resolve, reject) => {
			task.resolve = resolve;
			task.reject = reject;
		});

		// 若当前无任务执行 则作为当前任务执行队列
		if (!task.queue.task) {         
			this[EXEC_FN](task);
		}

		return promise;
	}

	setMaxSize(key, maxSize = 0) {
		let oldMaxSize = this.maxSize;
		if (key == undefined) {
			this.maxSize = maxSize;
		} else {
			const queue = this[QUEUE_FN](key);
			oldMaxSize = queue.maxSize;
			queue.maxSize = maxSize;
		}

		return oldMaxSize || 0;
	}

	setTimeout(key, timeout = 0) {
		let oldTimeout = this.timeout;
		if (key == undefined) {
			this.timeout = timeout;
		} else {
			const queue = this[QUEUE_FN](key);
			oldTimeout = queue.timeout;
			queue.timeout = timeout;
		}

		return timeout || 0;
	}

	size(key) {
		if (key == undefined) return _.keys(this[QUEUES_VAR]).length;
		return (this[QUEUES_VAR][key] || []).length;
	}

	setFileLock(enable, dir) {
		this.enableFileLock = enable;
		this.fileLockDir = dir || "";
		mkdir(dir);
	}
}

module.exports = new AsyncQueue();
