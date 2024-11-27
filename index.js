const express = require("express");
const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (_, res) => res.sendFile(__dirname + "/index.html"));

// Ensure app listens on the specified port
app.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
});

// Function to write logs to logs.txt
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim()); // Also print to console
  fs.appendFileSync('logs.txt', logMessage, 'utf8');
}

function createBot() {
  const bot = mineflayer.createBot({
    host: 'minekrapjihyo.aternos.me',
    version: false, // Replace with specific version, e.g., '1.16.5' if needed
    username: 'HotJihyo',
    port: 53281,
    plugins: [],
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  // Log successful connection
  bot.on('login', () => logToFile('Bot logged in successfully.'));
  bot.on('spawn', () => logToFile('Bot spawned in the world.'));
  bot.on('end', () => logToFile('Bot connection ended. Attempting to reconnect.'));
  bot.on('kicked', (reason) => logToFile(`Bot was kicked: ${reason}`));
  bot.on('error', (err) => logToFile(`An error occurred: ${err.message}`));

  // Handle disconnections with a delay to prevent duplicated login
  bot.on('end', () => {
    logToFile('Reconnecting in 30 seconds...');
    setTimeout(createBot, 30000); // 30-second delay
  });

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes('sword'));
      if (sword) bot.equip(sword, 'hand');
    }, 150);

    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes('shield'));
      if (shield) bot.equip(shield, 'off-hand');
    }, 250);
  });

  let guardPos = null;

  function guardArea(pos) {
    guardPos = pos.clone();
    logToFile(`Guarding position set to: ${pos}`);
    if (!bot.pvp.target) {
      moveToGuardPos();
    }
  }

  function stopGuarding() {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
    logToFile('Stopped guarding.');
  }

  function moveToGuardPos() {
    const mcData = require('minecraft-data')(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
    logToFile(`Moving to guard position: ${guardPos}`);
  }

  bot.on('stoppedAttacking', () => {
    if (guardPos) {
      logToFile('Stopped attacking, returning to guard position.');
      moveToGuardPos();
    }
  });

  bot.on('physicTick', () => {
    if (bot.pvp.target) return;
    if (bot.pathfinder.isMoving()) return;

    const entity = bot.nearestEntity();
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
  });

  bot.on('physicTick', () => {
    if (!guardPos) return;
    const filter = (e) =>
      e.type === 'mob' &&
      e.position.distanceTo(bot.entity.position) < 16 &&
      e.mobType !== 'Armor Stand';
    const entity = bot.nearestEntity(filter);
    if (entity) {
      logToFile(`Attacking entity: ${entity.mobType}`);
      bot.pvp.attack(entity);
    }
  });

  bot.on('chat', (username, message) => {
    if (message === 'guard') {
      const player = bot.players[username];

      if (!player) {
        bot.chat('I will guard here!');
        logToFile(`Started guarding for player: ${username}`);
        guardArea(player.entity.position);
      }
    }
    if (message === 'love you') {
      bot.chat('I Love you Too Meri jaan :)');
      logToFile('Bot responded to love message.');
      stopGuarding();
    }
  });

  // Catch unhandled errors
  process.on('uncaughtException', (err) => {
    logToFile(`Unhandled exception: ${err.message}`);
  });
}

createBot();
