import { boss } from "./queue";
import { registerHandlers } from "./handlers";

await boss.start();
await registerHandlers(boss);
console.log("Worker started");
