
## AsyncQueue

NodeJs 异步(async)队列, 提供一种顺序执行异步任务的机制. 如 web 服务某一个请求的某段代码需要互斥执行时, 就需要将此部分互斥执行代码进行排队, 下文也将互斥执行代码统称为任务 task. 技术交流群(733135641)

### 安装
```
npm install @wxaxiaoyao/async-queue --save
```

### 特性

- 支持 ES6 promise, async/wait
- 支持指定队列(queue)类型, 不同队列间不互斥. 同一队列互斥执行
- 支持任务优先级, 数值越大, 优先级越低. 默认值 1000
- 支持指定任务(task)超时, 默认 0  不超时
- 支持指定队列(queue)长度限制, 默认无限制, 执行完的任务会自动从队列中移除.
- 支持文件锁, 多进程同步控制

### 使用

```
// 基本示例
const AsyncQueue = require("@wxaxiaoyao/async-queue");

const ret = await AsyncQueue.exec("queue name", function() {
	console.log("task code");
}, {
	timeout:0,     // 超时时间, 不超时
	priority: 10,  // 任务优先级
}).catch(err => console.log(err));

// 并发示例
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
```

### 单元测试
> npm test 运行单元测试

### API

#### AsyncQueue.create({maxSize, timeout, enableFileLock, fileLockPath})
> 创建异步队列示例, AsyncQueue 本身也是一个示例.

- maxSize 队列大小, 默认0
- timeout 任务超时时间, 默认 0ms
- enableFileLock 是否开始文件锁 默认 false
- fileLockPath 文件锁目录 默认 ""
- lockwait 上锁等待时间 默认 60000ms 超时时间上锁失败, 任务失败

#### AsyncQueue.exec(key, fn, opt)
> 执行异步任务

- key string 队列名称, 具有唯一性
- fn funtion 任务函数, 必须为函数
- opt object 可选 
  - opt.timeout 超时时间, 默认 0ms 
  - opt.priority 任务优先级 默认1000
  - opt.maxSize 当前任务队列最大任务数   队列最大任务数 opt.maxSize || queue.maxSize || AsyncQueue.maxSize

#### AsyncQueue.setTimeout(key, timeout)
> 设置指定队列任务超时时间

- key string|undefined 队列名称, 具有唯一性, 当为 undefined 时设置所有队列默认值, 即 AsyncQueue.timeout = timeout;
- timeout number 毫秒, 

#### AsyncQueue.setMaxSize(key, maxSize)
> 设置指定队列大小

- key string|undefined 队列名称, 具有唯一性, 当为 undefined 时设置所有队列默认值, 即 AsyncQueue.maxSize = maxSize;
- maxSize number 队列最大任务数 0 不做限制

#### AsyncQueue.setFileLock(enable, path)
> 使能文件锁

- enable boolean 是否开启文件锁
- path string 文件锁目录



