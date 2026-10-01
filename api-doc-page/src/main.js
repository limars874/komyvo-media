import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

document.documentElement.dataset.theme = 'dark';
createApp(App).mount('#app');
