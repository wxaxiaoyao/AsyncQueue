
## AsyncQueue

NodeJs 异步(async)队列, 提供一种顺序执行异步任务的机制. 如 web 服务某一个请求的某段代码需要互斥执行时, 就需要将此部分互斥执行代码进行排队, 下文也将互斥执行代码统称为任务 task.

### 安装
```
npm install @wxaxiaoyao/async-queue --save
```

### 特性

- 支持 ES6 promise, async/wait
- 支持指定队列(queue)类型, 不同队列间不互斥. 同一队列互斥执行
- 支持任务优先级, 数值越大, 优先级越低. 默认值 1000
- 支持指定任务(task)超时, 默认不超时.
- 支持指定队列(queue)长度限制, 默认无限制, 执行完的任务会自动从队列中移除.

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

#### AsyncQueue.exec(key, fn, opt)

- key string 队列名称, 具有唯一性
- fn funtion 任务函数, 必须为函数
- opt object 可选 
  - opt.timeout 超时时间, 默认 0 不超时
  - opt.priority 任务优先级 默认1000
  - opt.maxSize 当前任务队列最大任务数   队列最大任务数 opt.maxSize || queue.maxSize || AsyncQueue.maxSize

#### AsyncQueue.setTimeout(key, timeout)
- key string|undefined 队列名称, 具有唯一性, 当为 undefined 时设置所有队列默认值, 即 AsyncQueue.timeout = timeout;
- timeout number 毫秒, 0 不超时

#### AsyncQueue.setMaxSize(key, maxSize)
- key string|undefined 队列名称, 具有唯一性, 当为 undefined 时设置所有队列默认值, 即 AsyncQueue.maxSize = maxSize;
- maxSize number 队列最大任务数 0 不做限制



