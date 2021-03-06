const _fs = require("fs");
const _path = require("path");
const base64 = require('js-base64').Base64;
const _ = require("lodash");

const util = require("./util.js");

const QUEUES_VAR = Symbol("QUEUES_VAR");
const QUEUE_FN = Symbol("QUEUE_FN");
const DONE_FN = Symbol("DONE_FN");
const EXEC_FN = Symbol("EXEC_FN");
const TASK_FN = Symbol("TASK_FN");
const LOCK_FN = Symbol("LOCK_FN");
const UNLOCK_FN = Symbol("UNLOCK_FN");
const PROPS = Symbol("PROPERTY");

class AsyncQueue {
	constructor(opts = {}) {
		this[QUEUES_VAR] = {};
		this[PROPS] = {};
		this[PROPS].maxSize = opts.maxSize || 0;                               // 不做限制
		this[PROPS].timeout = opts.timeout || 0;                               // 默认超时时间
		this[PROPS].lockwait = opts.lockwait || 60000;
        
        this.setFileLock(opts.enableFileLock, opts.fileLockPath);
	}

	// 使用目录锁
	async [LOCK_FN](dirname, timeout = 60000) {
        //console.log(`上锁资源: ${dirname}`);
		const startTime = _.now();
		// 最大超时时间 60s 防止死循环
		return new Promise((resolve, reject) => {
			const _lock = () => {
				//const ok = util.mkdir(dirname);
				//if (ok) return resolve(true);
				try {
					_fs.mkdirSync(dirname);
                    //console.log(`上锁成功: ${dirname}`);
					return resolve(true);
				} catch(e) {
                    //console.log(e);
				}
				if (timeout && (_.now() - startTime) > timeout) return resolve(false);
				//console.log(`资源被锁定, 等待解锁: ${dirname}`);
				setTimeout(_lock, 100);
			}
			return _lock();
		});
	}

	[UNLOCK_FN](dirname) {
		//console.log(`解锁资源: ${dirname}`);
		//util.rmdir(dirname);
		try {
            _fs.rmdirSync(dirname);
			return true;
		} catch(e) {
			return false;
		}
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
		// 移除定时器
		clearTimeout(task.timer);

		// 当前任务执行完, 则执行下一个任务
		if (queue.task && task.id === queue.task.id) {
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
		const props = this[PROPS];
		
		let dirname = "";
		// 文件锁 
		if (props.enableFileLock) {
			const fileLockPath = props.fileLockPath || "";
			const base64Key = base64.encode(task.key);

			dirname = _path.join(fileLockPath, base64Key + '.lock');  // 加后缀防止资源为空与锁目录相冲

			const ok = await this[LOCK_FN](dirname, props.lockwait);
			if (!ok) return this[DONE_FN](task, undefined, new Error(`${key} lock failed`));
		}

		// 执行完
		const done = (data, err) => {
			if (props.enableFileLock) {
				this[UNLOCK_FN](dirname);
			}
			this[DONE_FN](task, data, err);
		}

		// 执行任务
		util.promiseTry(() => {
			return task.fn();
		}).then(data => {
			done(data, undefined);
		}).catch(err => {
			done(undefined, err);
		});
	}

	// 添加任务
	[TASK_FN](key, fn, opts) {
		const queue = this[QUEUE_FN](key);            // 当前资源队列
		
		const maxSize = opts.maxSize || queue.maxSize || this[PROPS].maxSize;

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
			task.timer = setTimeout(() => {
				this[DONE_FN](task, undefined, new Error("task timeout"));
			}, task.timeout);
		}

		return task;
	}

	// 创建实例
	create(opts) {
		return new AsyncQueue(opts);
	}

	// 执行任务
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

	// 设置最大队列长度
	setMaxSize(key, maxSize = 0) {
		let oldMaxSize = this[PROPS].maxSize;
		if (key == undefined) {
			this[PROPS].maxSize = maxSize;
		} else {
			const queue = this[QUEUE_FN](key);
			oldMaxSize = queue.maxSize;
			queue.maxSize = maxSize;
		}

		return oldMaxSize || 0;
	}

	// 设置队列任务超时时间
	setTimeout(key, timeout = 0) {
		let oldTimeout = this[PROPS].timeout;
		if (key == undefined) {
			this[PROPS].timeout = timeout;
		} else {
			const queue = this[QUEUE_FN](key);
			oldTimeout = queue.timeout;
			queue.timeout = timeout;
		}

		return timeout || 0;
	}

	// 获取队列任务数
	size(key) {
		if (key == undefined) return _.keys(this[QUEUES_VAR]).length;
		return (this[QUEUES_VAR][key] || []).length;
	}

	// 使能文件锁  进程文件锁, 程序启动应清空锁文件
	setFileLock(enable, path) {
		this[PROPS].enableFileLock = enable;
		this[PROPS].fileLockPath = _path.join(path || "", "lock");

        if (enable) {
            util.rmdir(this[PROPS].fileLockPath);
            util.mkdir(this[PROPS].fileLockPath);
        }
	}
}

module.exports = AsyncQueue;
