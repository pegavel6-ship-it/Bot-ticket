const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// CONFIG
const STAFF_ROLES = [
  '1444832394023665746'
];

const STAFF_IDS = [
  '1444739653910401227',
  '1360050181747245258',
  '1391831451309445170'
];

const TICKET_CATEGORY = '1357179958837117148';
const LOGS_CHANNEL = '1472638374081990892';
const AVALIACOES_CHANNEL = '1495203445534228590';

// CONTROLE
let tickets = {};
let ticketsFechados = {};
const avaliou = new Set();

client.once('clientReady', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// 📌 PAINEL
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!painel') {

    const embed = new EmbedBuilder()
      .setColor(0x0094ff)
      .setTitle('Central de Atendimento')
      .setDescription(
`Bem-vindo à Central de Atendimento.

Este canal é destinado ao suporte geral do servidor, incluindo dúvidas, denúncias, suporte técnico, parcerias e demais assuntos administrativos.

Para iniciar o atendimento, selecione uma opção abaixo e abra um ticket na categoria correspondente ao seu caso.

Descreva sua solicitação com clareza para um atendimento mais rápido.`
      )
      .setThumbnail('https://cdn.discordapp.com/icons/1357178521323307158/a_749f45a4876357efb8ccd60de3b3e605.gif?size=2048')
      .setImage('https://cdn.discordapp.com/attachments/1445507023390376209/1495201378975612969/IMG-20260418-WA0033.jpg');

    const menu = new StringSelectMenuBuilder()
      .setCustomId('menu_ticket')
      .setPlaceholder('Selecione uma opção')
      .addOptions([
        { label: 'Dúvidas', value: 'duvidas', emoji: '❓' },
        { label: 'Campeonatos', value: 'campeonatos', emoji: '🏆' },
        { label: 'Denúncias', value: 'denuncias', emoji: '⚠️' },
        { label: 'Cargos', value: 'cargos', emoji: '🏷️' },
        { label: 'Verificação', value: 'verificacao', emoji: '✅' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// INTERAÇÕES
client.on('interactionCreate', async (interaction) => {

  // 🎫 MENU (SEM ERRO)
  if (interaction.isStringSelectMenu()) {

    await interaction.deferReply({ ephemeral: true });

    if (tickets[interaction.user.id]) {
      return interaction.editReply({ content: 'Você já tem um ticket aberto.' });
    }

    const tipo = interaction.values[0];

    const canal = await interaction.guild.channels.create({
      name: `${tipo}-ticket`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY,
      topic: interaction.user.id,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, type: 1, allow: [PermissionsBitField.Flags.ViewChannel] },
        ...STAFF_ROLES.map(id => ({
          id,
          type: 0,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        })),
        ...STAFF_IDS.map(id => ({
          id,
          type: 1,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }))
      ]
    });

    tickets[interaction.user.id] = {
      canal: canal.id,
      staff: null
    };

    let msg = 'Explique seu problema com detalhes.';
    if (tipo === 'cargos') msg = 'Informe qual cargo você precisa.';
    if (tipo === 'verificacao') msg = 'Explique seu problema com verificação.';

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('assumir').setLabel('Assumir').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('fechar').setLabel('Fechar').setStyle(ButtonStyle.Danger)
    );

    await canal.send({
      content: `<@${interaction.user.id}>`,
      embeds: [new EmbedBuilder().setColor(0x0094ff).setDescription(msg)],
      components: [botoes]
    });

    interaction.editReply({ content: `Ticket criado: ${canal}` });
  }

  // 👤 ASSUMIR
  if (interaction.isButton() && interaction.customId === 'assumir') {

    const userId = interaction.channel.topic;

    if (tickets[userId]) {
      tickets[userId].staff = interaction.user;
    }

    interaction.reply({ content: `Assumido por ${interaction.user}` });
  }

  // 🔒 FECHAR
  if (interaction.isButton() && interaction.customId === 'fechar') {

    const userId = interaction.channel.topic;
    const data = tickets[userId];

    const mensagens = await interaction.channel.messages.fetch({ limit: 100 });

    const texto = mensagens
      .map(m => `${m.author.tag}: ${m.content}`)
      .reverse()
      .join('\n');

    const transcriptFile = path.join(__dirname, 'transcript.txt');
    fs.writeFileSync(transcriptFile, texto);
    const file = new AttachmentBuilder(transcriptFile);

    const logs = interaction.guild.channels.cache.get(LOGS_CHANNEL);
    if (logs) logs.send({ files: [file] });

    try {
      const user = await client.users.fetch(userId);
      await user.send({ files: [file] });
    } catch {}

    // salvar antes de deletar
    ticketsFechados[userId] = data;
    delete tickets[userId];

    // avaliação
    const estrelas = new ActionRowBuilder().addComponents(
      [1,2,3,4,5].map(n =>
        new ButtonBuilder()
          .setCustomId(`avaliar_${n}_${userId}`)
          .setLabel(`${n}⭐`)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    try {
      const user = await client.users.fetch(userId);
      await user.send({ content: 'Avalie o atendimento:', components: [estrelas] });
    } catch {}

    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
  }

  // ⭐ AVALIAÇÃO
  if (interaction.isButton() && interaction.customId.startsWith('avaliar_')) {

    const [_, nota, userId] = interaction.customId.split('_');

    if (avaliou.has(interaction.user.id)) {
      return interaction.reply({ content: 'Você já avaliou.', ephemeral: true });
    }

    avaliou.add(interaction.user.id);

    const guild = client.guilds.cache.first();
    const canal = guild.channels.cache.get(AVALIACOES_CHANNEL);
    const data = ticketsFechados[userId];

    const embed = new EmbedBuilder()
      .setColor(0x0094ff)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL()
      })
      .addFields(
        { name: 'Usuário', value: `<@${userId}>`, inline: true },
        { name: 'Staff', value: `${data?.staff || 'Não definido'}`, inline: true },
        { name: 'Nota', value: `${nota}/5`, inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL());

    if (canal) canal.send({ embeds: [embed] });

    interaction.reply({ content: 'Avaliação enviada.', ephemeral: true });
  }

});

// SERVIDOR WEB
const express = require('express');
const https = require('https');
const http = require('http');
const app = express();

app.get('/', (req, res) => {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ⏰ Ping recebido — bot acordado!`);
  res.send('Bot online!');
});

const KEEPALIVE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/`
  : null;

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor web ativo');
  if (KEEPALIVE_URL) {
    console.log(`🔗 URL do UptimeRobot (configure a cada 5 min): ${KEEPALIVE_URL}`);
  }
});

function selfPing() {
  if (!KEEPALIVE_URL) {
    console.log('[Self-ping] URL não encontrada, pulando ping.');
    return;
  }
  https.get(KEEPALIVE_URL, (res) => {
    console.log(`[${new Date().toLocaleTimeString('pt-BR')}] 🔄 Self-ping OK — status ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[${new Date().toLocaleTimeString('pt-BR')}] ❌ Self-ping falhou: ${err.message}`);
  });
}

// Pinga a cada 3 minutos para evitar que o Replit durma
setInterval(selfPing, 3 * 60 * 1000);

client.login(process.env.TOKEN);
