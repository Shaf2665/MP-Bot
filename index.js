require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const fs = require("fs");
const db = require("quick.db");
const Parser = require("rss-parser");
const parser = new Parser();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

// Load commands
fs.readdirSync("./commands").forEach(file => {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
});

// Load events
fs.readdirSync("./events").forEach(file => {
  const event = require(`./events/${file}`);
  if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
  else client.on(event.name, (...args) => event.execute(...args, client));
});

// Command handler
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;
  const args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (!client.commands.has(commandName)) return;
  try {
    await client.commands.get(commandName).execute(message, args, client);
  } catch (error) {
    console.error(error);
    message.reply("❌ Error executing that command!");
  }
});

// Level XP handler
client.on("messageCreate", (message) => {
  if (message.author.bot || !message.guild) return;
  let xp = db.get(`xp_${message.author.id}_${message.guild.id}`) || 0;
  xp += Math.floor(Math.random() * 10) + 5;
  db.set(`xp_${message.author.id}_${message.guild.id}`, xp);
  let level = db.get(`level_${message.author.id}_${message.guild.id}`) || 1;
  if (xp > level * 100) {
    db.set(`level_${message.author.id}_${message.guild.id}`, level + 1);
    message.channel.send(`🎉 Congrats <@${message.author.id}>! You reached Level ${level + 1}!`);
  }
});

// YouTube Poller
setInterval(async () => {
  client.guilds.cache.forEach(async (guild) => {
    const rss = db.get(`yt_${guild.id}`);
    if (!rss) return;
    try {
      const feed = await parser.parseURL(rss);
      const latest = feed.items[0];
      const lastPosted = db.get(`lastVid_${guild.id}`);
      if (latest.link !== lastPosted) {
        const channel = guild.systemChannel;
        if (channel) channel.send(`🔔 New Video: **${latest.title}**\n${latest.link}`);
        db.set(`lastVid_${guild.id}`, latest.link);
      }
    } catch (e) {
      console.error("YT fetch error:", e);
    }
  });
}, 60000);

client.login(process.env.TOKEN);
