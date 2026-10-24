import { App } from './app.js';
import { GAME_NAME } from './config.js';

document.title = GAME_NAME;
const app = new App();
app.init();
