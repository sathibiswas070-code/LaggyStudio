require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require("discord.js");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing from .env");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is missing from .env");
  process.exit(1);
}

// ============================================================
// DATABASE
// ============================================================

const DB_FILE = path.join(__dirname, "database.json");

const DEFAULT_DB = {
  settings: {},
  tasks: [],
  statuses: {},
  notes: {},
  applications: [],
  rateRequests: [],
  polls: []
};

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
      return structuredClone(DEFAULT_DB);
    }

    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    return {
      ...structuredClone(DEFAULT_DB),
      ...data,
      settings: data.settings || {},
      tasks: data.tasks || [],
      statuses: data.statuses || {},
      notes: data.notes || {},
      applications: data.applications || [],
      rateRequests: data.rateRequests || [],
      polls: data.polls || []
    };
  } catch (error) {
    console.error("❌ Could not load database:", error);
    return structuredClone(DEFAULT_DB);
  }
}

let db = loadDB();

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error("❌ Could not save database:", error);
  }
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ============================================================
// HELPERS
// ============================================================

function getSettings(guildId) {
  if (!db.settings[guildId]) {
    db.settings[guildId] = {
      applicationChannel: null,
      applicationLogChannel: null,
      statusChannel: null,
      managerRole: null
    };

    saveDB();
  }

  return db.settings[guildId];
}

function isManager(interaction) {
  if (!interaction.guild) return false;

  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const settings = getSettings(interaction.guild.id);

  if (
    settings.managerRole &&
    interaction.member?.roles?.cache?.has(settings.managerRole)
  ) {
    return true;
  }

  return false;
}

function shorten(text, max = 80) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function statusInfo(status) {
  switch (status) {
    case "online":
      return {
        label: "🟢 Online",
        description: "Available"
      };

    case "idle":
      return {
        label: "🟡 Idle",
        description: "Not currently working"
      };

    case "unavailable":
      return {
        label: "🔴 Unavailable",
        description: "Currently not available"
      };

    default:
      return {
        label: "⚪ Unknown",
        description: "No status set"
      };
  }
}

async function sendApplicationPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("Developer Applications")
    .setDescription(
      "Interested in joining the development team?\n\n" +
      "Click the button below to submit an application."
    )
    .setColor(0x5865f2);

  const button = new ButtonBuilder()
    .setCustomId("open_application")
    .setLabel("Apply")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  return channel.send({
    embeds: [embed],
    components: [row]
  });
}

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [

  // ----------------------------------------------------------
  // SETUP
  // ----------------------------------------------------------

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the developer system")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub =>
      sub
        .setName("channels")
        .setDescription("Configure the bot channels")
        .addChannelOption(option =>
          option
            .setName("applications")
            .setDescription("Channel where applications are submitted")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName("logs")
            .setDescription("Channel where applications are logged")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName("status")
            .setDescription("Channel for developer status updates")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName("manager")
            .setDescription("Manager role")
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("apply")
        .setDescription("Place the application panel in a channel")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Channel where the application panel should be placed")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  // ----------------------------------------------------------
  // APPLY
  // ----------------------------------------------------------

  new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Send the developer application panel"),

  // ----------------------------------------------------------
  // TASK
  // ----------------------------------------------------------

  new SlashCommandBuilder()
    .setName("task")
    .setDescription("Manage development tasks")

    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create a new task")
        .addStringOption(option =>
          option
            .setName("title")
            .setDescription("Task title")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("description")
            .setDescription("Task description")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List all tasks")
    )

    .addSubcommand(sub =>
      sub
        .setName("claim")
        .setDescription("Claim a task")
        .addIntegerOption(option =>
          option
            .setName("id")
            .setDescription("Task ID")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("complete")
        .setDescription("Complete a task")
        .addIntegerOption(option =>
          option
            .setName("id")
            .setDescription("Task ID")
            .setRequired(true)
        )
    ),

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Manage your developer status")

    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Set your developer status")
        .addStringOption(option =>
          option
            .setName("status")
            .setDescription("Your current status")
            .setRequired(true)
            .addChoices(
              {
                name: "🟢 Online",
                value: "online"
              },
              {
                name: "🟡 Idle",
                value: "idle"
              },
              {
                name: "🔴 Unavailable",
                value: "unavailable"
              }
            )
        )
        .addStringOption(option =>
          option
            .setName("message")
            .setDescription("Optional message about your status")
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View developer statuses")
    ),

  // ----------------------------------------------------------
  // NOTE
  // ----------------------------------------------------------

  new SlashCommandBuilder()
    .setName("note")
    .setDescription("Manage your private notes")

    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a private note")
        .addStringOption(option =>
          option
            .setName("text")
            .setDescription("Your note")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("View your private notes")
    )

    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete one of your notes")
        .addIntegerOption(option =>
          option
            .setName("id")
            .setDescription("Note ID")
            .setRequired(true)
        )
    ),

  // ----------------------------------------------------------
  // DEVPOLL
  // ----------------------------------------------------------

  new SlashCommandBuilder()
    .setName("devpoll")
    .setDescription("Create a developer poll")
    .addStringOption(option =>
      option
        .setName("question")
        .setDescription("Poll question")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("option1")
        .setDescription("First option")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("option2")
        .setDescription("Second option")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("option3")
        .setDescription("Third option")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("option4")
        .setDescription("Fourth option")
        .setRequired(false)
    ),

  // ----------------------------------------------------------
  // RATE
  // ----------------------------------------------------------

  new SlashCommandBuilder()
    .setName("rate")
    .setDescription("Manage developer payment rates")

    .addSubcommand(sub =>
      sub
        .setName("request")
        .setDescription("Request a payment rate")
        .addStringOption(option =>
          option
            .setName("current")
            .setDescription("Your current rate")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("requested")
            .setDescription("The rate you are requesting")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("reason")
            .setDescription("Reason for the request")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("View rate requests")
    )

    .addSubcommand(sub =>
      sub
        .setName("approve")
        .setDescription("Approve a rate request")
        .addIntegerOption(option =>
          option
            .setName("id")
            .setDescription("Request ID")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("deny")
        .setDescription("Deny a rate request")
        .addIntegerOption(option =>
          option
            .setName("id")
            .setDescription("Request ID")
            .setRequired(true)
        )
    )
];

// ============================================================
// REGISTER COMMANDS
// ============================================================

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands.map(command => command.toJSON())
      }
    );

    console.log("✅ Slash commands registered globally.");
  } catch (error) {
    console.error("❌ Command registration failed:", error);
  }
}

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🆔 Client ID: ${client.user.id}`);

  await registerCommands();

  client.user.setActivity("Developer System", {
    type: 0
  });
});

// ============================================================
// INTERACTIONS
// ============================================================

client.on("interactionCreate", async interaction => {

  try {

    // ========================================================
    // BUTTONS
    // ========================================================

    if (interaction.isButton()) {

      // ------------------------------------------------------
      // APPLICATION BUTTON
      // ------------------------------------------------------

      if (interaction.customId === "open_application") {

        const modal = new ModalBuilder()
          .setCustomId("application_modal")
          .setTitle("Developer Application");

        const position = new TextInputBuilder()
          .setCustomId("position")
          .setLabel("Position")
          .setPlaceholder("Example: Scripter, Builder, UI Designer")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const rate = new TextInputBuilder()
          .setCustomId("rate")
          .setLabel("Expected Rate")
          .setPlaceholder("Example: $10/hour")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const reason = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Why should we accept you?")
          .setPlaceholder("Tell us about yourself and your experience.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(position),
          new ActionRowBuilder().addComponents(rate),
          new ActionRowBuilder().addComponents(reason)
        );

        // Showing the modal itself acknowledges the interaction.
        await interaction.showModal(modal);

        return;
      }

      // ------------------------------------------------------
      // POLL BUTTON
      // ------------------------------------------------------

      if (interaction.customId.startsWith("poll_")) {

        // ACKNOWLEDGE IMMEDIATELY.
        await interaction.deferUpdate();

        const parts = interaction.customId.split("_");

        const pollId = Number(parts[1]);
        const optionNumber = Number(parts[2]);

        const poll = db.polls.find(p => p.id === pollId);

        if (!poll) {
          await interaction.followUp({
            content: "❌ This poll no longer exists.",
            ephemeral: true
          });

          return;
        }

        if (!poll.votes) {
          poll.votes = {};
        }

        const userId = interaction.user.id;

        // Remove previous vote.
        for (const option of poll.options) {
          option.votes = option.votes || [];

          option.votes = option.votes.filter(
            id => id !== userId
          );
        }

        // Add new vote.
        if (poll.options[optionNumber]) {
          poll.options[optionNumber].votes =
            poll.options[optionNumber].votes || [];

          poll.options[optionNumber].votes.push(userId);
        }

        saveDB();

        // Rebuild poll embed.
        const embed = new EmbedBuilder()
          .setTitle("📊 Developer Poll")
          .setDescription(poll.question)
          .setColor(0x5865f2);

        for (let i = 0; i < poll.options.length; i++) {
          const option = poll.options[i];

          embed.addFields({
            name: `${i + 1}. ${option.text}`,
            value: `Votes: ${option.votes.length}`,
            inline: false
          });
        }

        const row = new ActionRowBuilder();

        poll.options.forEach((option, index) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`poll_${poll.id}_${index}`)
              .setLabel(shorten(option.text))
              .setStyle(ButtonStyle.Primary)
          );
        });

        await interaction.message.edit({
          embeds: [embed],
          components: [row]
        });

        await interaction.followUp({
          content: "✅ Your vote has been recorded.",
          ephemeral: true
        });

        return;
      }
    }

    // ========================================================
    // MODALS
    // ========================================================

    if (interaction.isModalSubmit()) {

      // ------------------------------------------------------
      // APPLICATION MODAL
      // ------------------------------------------------------

      if (interaction.customId === "application_modal") {

        // ACKNOWLEDGE IMMEDIATELY.
        await interaction.deferReply({
          ephemeral: true
        });

        const position =
          interaction.fields.getTextInputValue("position");

        const rate =
          interaction.fields.getTextInputValue("rate");

        const reason =
          interaction.fields.getTextInputValue("reason");

        const applicationId =
          db.applications.length + 1;

        const application = {
          id: applicationId,
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          username: interaction.user.tag,
          position,
          rate,
          reason,
          status: "pending",
          createdAt: new Date().toISOString()
        };

        db.applications.push(application);
        saveDB();

        const settings =
          getSettings(interaction.guild.id);

        // Send application to log channel.
        if (settings.applicationLogChannel) {

          const logChannel =
            interaction.guild.channels.cache.get(
              settings.applicationLogChannel
            );

          if (logChannel) {

            const embed = new EmbedBuilder()
              .setTitle(`📩 New Application #${applicationId}`)
              .setColor(0x5865f2)
              .addFields(
                {
                  name: "Applicant",
                  value: `<@${interaction.user.id}>`,
                  inline: true
                },
                {
                  name: "Position",
                  value: position,
                  inline: true
                },
                {
                  name: "Expected Rate",
                  value: rate,
                  inline: true
                },
                {
                  name: "Reason",
                  value: reason
                }
              )
              .setTimestamp();

            await logChannel.send({
              embeds: [embed]
            });
          }
        }

        await interaction.editReply({
          content:
            `✅ Your application has been submitted.\n` +
            `Application ID: **#${applicationId}**`
        });

        return;
      }
    }

    // ========================================================
    // SLASH COMMANDS
    // ========================================================

    if (!interaction.isChatInputCommand()) {
      return;
    }

    // Most commands are guild-only.
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ This command can only be used inside a server.",
        ephemeral: true
      });

      return;
    }

    // ========================================================
    // SETUP
    // ========================================================

    if (interaction.commandName === "setup") {

      if (!interaction.memberPermissions?.has(
        PermissionFlagsBits.Administrator
      )) {
        await interaction.reply({
          content: "❌ You need Administrator permission to use this.",
          ephemeral: true
        });

        return;
      }

      // ACKNOWLEDGE IMMEDIATELY.
      await interaction.deferReply({
        ephemeral: true
      });

      const subcommand =
        interaction.options.getSubcommand();

      const settings =
        getSettings(interaction.guild.id);

      // ------------------------------------------------------
      // /setup channels
      // ------------------------------------------------------

      if (subcommand === "channels") {

        const applications =
          interaction.options.getChannel("applications");

        const logs =
          interaction.options.getChannel("logs");

        const status =
          interaction.options.getChannel("status");

        const manager =
          interaction.options.getRole("manager");

        if (applications) {
          settings.applicationChannel =
            applications.id;
        }

        if (logs) {
          settings.applicationLogChannel =
            logs.id;
        }

        if (status) {
          settings.statusChannel =
            status.id;
        }

        if (manager) {
          settings.managerRole =
            manager.id;
        }

        saveDB();

        await interaction.editReply({
          content:
            "✅ Setup updated.\n\n" +
            `Application Channel: ${
              settings.applicationChannel
                ? `<#${settings.applicationChannel}>`
                : "Not set"
            }\n` +
            `Application Log: ${
              settings.applicationLogChannel
                ? `<#${settings.applicationLogChannel}>`
                : "Not set"
            }\n` +
            `Status Channel: ${
              settings.statusChannel
                ? `<#${settings.statusChannel}>`
                : "Not set"
            }\n` +
            `Manager Role: ${
              settings.managerRole
                ? `<@&${settings.managerRole}>`
                : "Not set"
            }`
        });

        return;
      }

      // ------------------------------------------------------
      // /setup apply
      // ------------------------------------------------------

      if (subcommand === "apply") {

        const channel =
          interaction.options.getChannel("channel");

        await sendApplicationPanel(channel);

        settings.applicationChannel =
          channel.id;

        saveDB();

        await interaction.editReply({
          content:
            `✅ Application panel placed in ${channel}.`
        });

        return;
      }
    }

    // ========================================================
    // APPLY
    // ========================================================

    if (interaction.commandName === "apply") {

      // ACKNOWLEDGE IMMEDIATELY.
      await interaction.deferReply({
        ephemeral: true
      });

      const settings =
        getSettings(interaction.guild.id);

      let channel = interaction.channel;

      if (settings.applicationChannel) {

        const configuredChannel =
          interaction.guild.channels.cache.get(
            settings.applicationChannel
          );

        if (configuredChannel) {
          channel = configuredChannel;
        }
      }

      await sendApplicationPanel(channel);

      await interaction.editReply({
        content:
          `✅ Application panel sent to ${channel}.`
      });

      return;
    }

    // ========================================================
    // TASK
    // ========================================================

    if (interaction.commandName === "task") {

      // ACKNOWLEDGE IMMEDIATELY.
      await interaction.deferReply({
        ephemeral: false
      });

      const subcommand =
        interaction.options.getSubcommand();

      // ------------------------------------------------------
      // CREATE
      // ------------------------------------------------------

      if (subcommand === "create") {

        if (!isManager(interaction)) {
          await interaction.editReply({
            content:
              "❌ Only managers can create tasks."
          });

          return;
        }

        const title =
          interaction.options.getString("title");

        const description =
          interaction.options.getString("description");

        const id =
          db.tasks.length > 0
            ? Math.max(...db.tasks.map(t => t.id)) + 1
            : 1;

        const task = {
          id,
          guildId: interaction.guild.id,
          title,
          description,
          createdBy: interaction.user.id,
          claimedBy: null,
          status: "open",
          createdAt: new Date().toISOString()
        };

        db.tasks.push(task);
        saveDB();

        await interaction.editReply({
          content:
            `✅ Task **#${id}** created.\n\n` +
            `**${title}**\n${description}`
        });

        return;
      }

      // ------------------------------------------------------
      // LIST
      // ------------------------------------------------------

      if (subcommand === "list") {

        const tasks =
          db.tasks.filter(
            task => task.guildId === interaction.guild.id
          );

        if (tasks.length === 0) {
          await interaction.editReply({
            content: "📋 There are no tasks yet."
          });

          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("📋 Development Tasks")
          .setColor(0x5865f2);

        for (const task of tasks.slice(0, 25)) {

          let statusText;

          if (task.status === "open") {
            statusText = "🟢 Open";
          } else if (task.status === "claimed") {
            statusText =
              `🟡 Claimed by <@${task.claimedBy}>`;
          } else {
            statusText = "✅ Completed";
          }

          embed.addFields({
            name: `#${task.id} — ${task.title}`,
            value:
              `${task.description}\n\n` +
              `**Status:** ${statusText}`,
            inline: false
          });
        }

        await interaction.editReply({
          embeds: [embed]
        });

        return;
      }

      // ------------------------------------------------------
      // CLAIM
      // ------------------------------------------------------

      if (subcommand === "claim") {

        const id =
          interaction.options.getInteger("id");

        const task =
          db.tasks.find(
            task =>
              task.id === id &&
              task.guildId === interaction.guild.id
          );

        if (!task) {
          await interaction.editReply({
            content: "❌ Task not found."
          });

          return;
        }

        if (task.status !== "open") {
          await interaction.editReply({
            content:
              "❌ This task has already been claimed or completed."
          });

          return;
        }

        task.claimedBy =
          interaction.user.id;

        task.status =
          "claimed";

        saveDB();

        await interaction.editReply({
          content:
            `✅ You claimed task **#${id}** — **${task.title}**.`
        });

        return;
      }

      // ------------------------------------------------------
      // COMPLETE
      // ------------------------------------------------------

      if (subcommand === "complete") {

        const id =
          interaction.options.getInteger("id");

        const task =
          db.tasks.find(
            task =>
              task.id === id &&
              task.guildId === interaction.guild.id
          );

        if (!task) {
          await interaction.editReply({
            content: "❌ Task not found."
          });

          return;
        }

        if (
          task.claimedBy !== interaction.user.id &&
          !isManager(interaction)
        ) {
          await interaction.editReply({
            content:
              "❌ You did not claim this task."
          });

          return;
        }

        task.status =
          "completed";

        saveDB();

        await interaction.editReply({
          content:
            `✅ Task **#${id}** has been marked as completed.`
        });

        return;
      }
    }

    // ========================================================
    // STATUS
    // ========================================================

    if (interaction.commandName === "status") {

      // ACKNOWLEDGE IMMEDIATELY.
      await interaction.deferReply({
        ephemeral: false
      });

      const subcommand =
        interaction.options.getSubcommand();

      // ------------------------------------------------------
      // SET
      // ------------------------------------------------------

      if (subcommand === "set") {

        const status =
          interaction.options.getString("status");

        const message =
          interaction.options.getString("message") || "";

        db.statuses[interaction.user.id] = {
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          status,
          message,
          updatedAt: new Date().toISOString()
        };

        saveDB();

        const info =
          statusInfo(status);

        await interaction.editReply({
          content:
            `${info.label} **${info.description}**\n` +
            (message
              ? `> ${message}`
              : "")
        });

        return;
      }

      // ------------------------------------------------------
      // VIEW
      // ------------------------------------------------------

      if (subcommand === "view") {

        const statuses =
          Object.values(db.statuses)
            .filter(
              status =>
                status.guildId === interaction.guild.id
            );

        if (statuses.length === 0) {
          await interaction.editReply({
            content:
              "📊 Nobody has set a developer status yet."
          });

          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("👨‍💻 Developer Status")
          .setColor(0x5865f2);

        for (const userStatus of statuses) {

          const info =
            statusInfo(userStatus.status);

          embed.addFields({
            name:
              `<@${userStatus.userId}> — ${info.label}`,
            value:
              userStatus.message
                ? `> ${userStatus.message}`
                : `*${info.description}*`,
            inline: false
          });
        }

        await interaction.editReply({
          embeds: [embed]
        });

        return;
      }
    }

    // ========================================================
    // NOTE
    // ========================================================

    if (interaction.commandName === "note") {

      // ACKNOWLEDGE IMMEDIATELY.
      await interaction.deferReply({
        ephemeral: true
      });

      const subcommand =
        interaction.options.getSubcommand();

      const userId =
        interaction.user.id;

      if (!db.notes[userId]) {
        db.notes[userId] = [];
      }

      // ------------------------------------------------------
      // ADD
      // ------------------------------------------------------

      if (subcommand === "add") {

        const text =
          interaction.options.getString("text");

        const id =
          db.notes[userId].length > 0
            ? Math.max(
                ...db.notes[userId].map(n => n.id)
              ) + 1
            : 1;

        db.notes[userId].push({
          id,
          text,
          createdAt: new Date().toISOString()
        });

        saveDB();

        await interaction.editReply({
          content:
            `📝 Note **#${id}** saved privately.`
        });

        return;
      }

      // ------------------------------------------------------
      // LIST
      // ------------------------------------------------------

      if (subcommand === "list") {

        const notes =
          db.notes[userId];

        if (!notes || notes.length === 0) {
          await interaction.editReply({
            content:
              "📝 You don't have any private notes."
          });

          return;
        }

        let output =
          "📝 **Your Private Notes**\n\n";

        for (const note of notes) {
          output +=
            `**#${note.id}** — ${note.text}\n`;
        }

        await interaction.editReply({
          content: output.slice(0, 4000)
        });

        return;
      }

      // ------------------------------------------------------
      // DELETE
      // ------------------------------------------------------

      if (subcommand === "delete") {

        const id =
          interaction.options.getInteger("id");

        const notes =
          db.notes[userId];

        const index =
          notes.findIndex(
            note => note.id === id
          );

        if (index === -1) {
          await interaction.editReply({
            content:
              "❌ Note not found."
          });

          return;
        }

        notes.splice(index, 1);

        saveDB();

        await interaction.editReply({
          content:
            `🗑️ Note **#${id}** deleted.`
        });

        return;
      }
    }

    // ========================================================
    // DEVPOLL
    // ========================================================

    if (interaction.commandName === "devpoll") {

      // ACKNOWLEDGE IMMEDIATELY.
      await interaction.deferReply({
        ephemeral: false
      });

      const question =
        interaction.options.getString("question");

      const options = [
        interaction.options.getString("option1"),
        interaction.options.getString("option2"),
        interaction.options.getString("option3"),
        interaction.options.getString("option4")
      ].filter(Boolean);

      const pollId =
        Date.now();

      const poll = {
        id: pollId,
        guildId: interaction.guild.id,
        question,
        options: options.map(text => ({
          text,
          votes: []
        })),
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
      };

      db.polls.push(poll);

      saveDB();

      const embed = new EmbedBuilder()
        .setTitle("📊 Developer Poll")
        .setDescription(question)
        .setColor(0x5865f2)
        .setFooter({
          text: `Poll ID: ${pollId}`
        });

      for (let i = 0; i < options.length; i++) {
        embed.addFields({
          name: `${i + 1}. ${options[i]}`,
          value: "Votes: 0",
          inline: false
        });
      }

      const row =
        new ActionRowBuilder();

      options.forEach((option, index) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(
              `poll_${pollId}_${index}`
            )
            .setLabel(shorten(option))
            .setStyle(ButtonStyle.Primary)
        );
      });

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

      return;
    }

    // ========================================================
    // RATE
    // ========================================================

    if (interaction.commandName === "rate") {

      // ACKNOWLEDGE IMMEDIATELY.
      await interaction.deferReply({
        ephemeral: true
      });

      const subcommand =
        interaction.options.getSubcommand();

      // ------------------------------------------------------
      // REQUEST
      // ------------------------------------------------------

      if (subcommand === "request") {

        const current =
          interaction.options.getString("current");

        const requested =
          interaction.options.getString("requested");

        const reason =
          interaction.options.getString("reason");

        // 30-day request cooldown.
        const now =
          Date.now();

        const thirtyDays =
          30 * 24 * 60 * 60 * 1000;

        const recentRequest =
          db.rateRequests.find(
            request =>
              request.guildId === interaction.guild.id &&
              request.userId === interaction.user.id &&
              now - new Date(request.createdAt).getTime()
                < thirtyDays
          );

        if (recentRequest) {

          await interaction.editReply({
            content:
              "❌ You can only submit a rate request once every 30 days."
          });

          return;
        }

        const id =
          db.rateRequests.length > 0
            ? Math.max(
                ...db.rateRequests.map(r => r.id)
              ) + 1
            : 1;

        const request = {
          id,
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          current,
          requested,
          reason,
          status: "pending",
          createdAt: new Date().toISOString()
        };

        db.rateRequests.push(request);

        saveDB();

        await interaction.editReply({
          content:
            `✅ Rate request **#${id}** submitted.`
        });

        return;
      }

      // ------------------------------------------------------
      // LIST
      // ------------------------------------------------------

      if (subcommand === "list") {

        if (!isManager(interaction)) {
          await interaction.editReply({
            content:
              "❌ Only managers can view rate requests."
          });

          return;
        }

        const requests =
          db.rateRequests.filter(
            request =>
              request.guildId === interaction.guild.id
          );

        if (requests.length === 0) {
          await interaction.editReply({
            content:
              "📋 There are no rate requests."
          });

          return;
        }

        const embed =
          new EmbedBuilder()
            .setTitle("💰 Rate Requests")
            .setColor(0x5865f2);

        for (const request of requests.slice(-25)) {

          embed.addFields({
            name:
              `#${request.id} — <@${request.userId}>`,
            value:
              `Current: **${request.current}**\n` +
              `Requested: **${request.requested}**\n` +
              `Reason: ${request.reason}\n` +
              `Status: **${request.status}**`,
            inline: false
          });
        }

        await interaction.editReply({
          embeds: [embed]
        });

        return;
      }

      // ------------------------------------------------------
      // APPROVE / DENY
      // ------------------------------------------------------

      if (
        subcommand === "approve" ||
        subcommand === "deny"
      ) {

        if (!isManager(interaction)) {
          await interaction.editReply({
            content:
              "❌ Only managers can manage rate requests."
          });

          return;
        }

        const id =
          interaction.options.getInteger("id");

        const request =
          db.rateRequests.find(
            request =>
              request.id === id &&
              request.guildId === interaction.guild.id
          );

        if (!request) {
          await interaction.editReply({
            content:
              "❌ Rate request not found."
          });

          return;
        }

        request.status =
          subcommand === "approve"
            ? "approved"
            : "denied";

        request.reviewedBy =
          interaction.user.id;

        request.reviewedAt =
          new Date().toISOString();

        saveDB();

        await interaction.editReply({
          content:
            `✅ Rate request **#${id}** has been **${request.status}**.`
        });

        // Try to DM the developer.
        try {

          const user =
            await client.users.fetch(
              request.userId
            );

          await user.send(
            `Your rate request **#${id}** in **${interaction.guild.name}** has been **${request.status}**.`
          );

        } catch {
          // Ignore DM failures.
        }

        return;
      }
    }

  } catch (error) {

    console.error("❌ Interaction error:", error);

    // ========================================================
    // SAFE ERROR RESPONSE
    // ========================================================

    try {

      if (interaction.deferred) {

        await interaction.editReply({
          content:
            "❌ Something went wrong while processing that interaction."
        });

      } else if (interaction.replied) {

        await interaction.followUp({
          content:
            "❌ Something went wrong while processing that interaction.",
          ephemeral: true
        });

      } else {

        await interaction.reply({
          content:
            "❌ Something went wrong while processing that interaction.",
          ephemeral: true
        });

      }

    } catch (responseError) {
      console.error(
        "❌ Could not send error response:",
        responseError
      );
    }
  }
});

// ============================================================
// LOGIN
// ============================================================

client.login(TOKEN);
