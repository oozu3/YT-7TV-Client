# Store listings

Texts and answers used on the Chrome Web Store and on addons.mozilla.org (AMO). Images are in this folder: `1-emotes.png` … `5-dark-theme.png` (1280×800) and `promo-small-440x280.png`.

- Repository: https://github.com/oozu3/YT-7TV-Client
- Support: https://github.com/oozu3/YT-7TV-Client/issues
- Privacy policy: https://github.com/oozu3/YT-7TV-Client/blob/main/PRIVACY.md

## Description (English)

YT 7TV Client brings 7TV emotes to YouTube live chat, using the emote set of a Twitch channel you pick.

• Asks once per channel: the first time you open a stream, choose which Twitch channel's 7TV emotes to use. If the streamer linked their YouTube channel on 7TV, it's suggested for you.
• Emotes in chat, including zero-width emotes stacked on top of the previous one. Hover an emote to see its name and author.
• Tab completion just like the 7TV extension: type a few letters and press Tab; Tab again for the next match, Shift+Tab to go back, arrow keys on the carousel. @name + Tab completes people in the chat.
• A 7TV tab in YouTube's emoji picker, with search, the channel's emotes and the 7TV global emotes.
• Live updates: emotes added, removed or renamed mid-stream show up without reloading.
• Helps with YouTube's limits: warns before the 200-character limit, flags messages YouTube didn't confirm, and switches the chat to "Live chat" so emote-only messages aren't hidden by "Top chat".
• Looks like YouTube, in light and dark themes, and speaks 10 languages.

Emotes are plain text in the message: people with the extension who picked the same Twitch channel see the images, everyone else sees the names.

No analytics, no tracking, no servers of its own. Free and open source (Apache 2.0): https://github.com/oozu3/YT-7TV-Client

Unofficial. Not affiliated with 7TV, YouTube or Twitch.

## Descrição (português)

O YT 7TV Client traz os emotes da 7TV para o chat ao vivo do YouTube, usando o set de emotes de um canal da Twitch à sua escolha.

• Pergunta uma vez por canal: na primeira vez que você abre uma live, escolha de qual canal da Twitch usar os emotes da 7TV. Se o streamer vinculou o canal do YouTube na 7TV, ele já aparece como sugestão.
• Emotes no chat, inclusive os zero-width, empilhados sobre o emote anterior. Passe o mouse para ver o nome e o autor.
• Tab-completion igual ao da extensão da 7TV: digite algumas letras e aperte Tab; Tab de novo para o próximo, Shift+Tab para voltar, setas no carrossel. @nome + Tab completa quem está no chat.
• Uma aba da 7TV no seletor de emojis do YouTube, com busca, os emotes do canal e os globais da 7TV.
• Atualização em tempo real: emotes adicionados, removidos ou renomeados no meio da live aparecem sem recarregar.
• Ajuda com os limites do YouTube: avisa antes do limite de 200 caracteres, marca mensagens que o YouTube não confirmou e troca o chat para "Chat ao vivo", para mensagens só com emotes não sumirem em "Principais mensagens".
• Visual do YouTube, nos temas claro e escuro, em 10 idiomas.

Os emotes são texto comum na mensagem: quem tem a extensão e escolheu o mesmo canal da Twitch vê as imagens; os outros veem os nomes.

Sem análise de uso, sem rastreamento, sem servidor próprio. Gratuito e de código aberto (Apache 2.0): https://github.com/oozu3/YT-7TV-Client

Não oficial. Sem vínculo com a 7TV, o YouTube ou a Twitch.

## Chrome Web Store

**Package:** `yt-7tv-client-<version>-chromium.zip`

**Store listing**

- Category: Social Networking
- Language: English (add Portuguese (Brazil) with the Portuguese description)
- Screenshots: `1-emotes.png` … `5-dark-theme.png`
- Small promo tile: `promo-small-440x280.png`
- Homepage URL and support URL: the repository and issues links above

**Privacy practices**

- Single purpose: Shows 7TV emotes, from a Twitch channel the user picks, in YouTube live chat, with 7TV-style Tab completion and an emote menu.
- `storage`: Saves the user's settings, which Twitch channel they picked for each YouTube channel, and a local copy of the emote sets so emotes appear instantly. Everything stays in the browser.
- `scripting`: Used only when the extension is installed or updated, to re-attach the content scripts to YouTube live chat frames that are already open, so they keep working without reloading the page.
- Host permission `https://www.youtube.com/*`: The content script runs in YouTube live chat (youtube.com/live_chat) to show emotes, and the extension reads the video page to find out which channel the chat belongs to.
- Host permission `https://7tv.io/*`: Loads emote sets and looks up Twitch channels through the 7TV API.
- Host permission `https://api.ivr.fi/*`: Fallback lookup of a Twitch channel ID when the 7TV lookup fails.
- Remote code: No. The extension only downloads JSON data and emote images, never code.
- Data usage: tick only **Web history**. The extension sends 7TV the ID of the YouTube channel whose live chat is open (to suggest a Twitch channel), which can count as browsing data. Chat text, names and keystrokes are only processed on the device. Tick the three certifications (no selling, no unrelated use, no creditworthiness use).
- Privacy policy URL: the PRIVACY.md link above.

## Firefox Add-ons (AMO)

**Package:** `yt-7tv-client-<version>-firefox.zip`

- Distribution: On this site (listed)
- Platforms: Firefox only (not Android)
- Source code: not needed. The code is plain, unminified JavaScript; the build only zips the files and adjusts the manifest.
- Summary (250 characters max): 7TV emotes in YouTube live chat, from the Twitch channel you pick. 7TV-style Tab completion, a 7TV tab in the emoji picker, live emote updates, YouTube's look in light and dark, 10 languages. Unofficial and open source.
- Categories: Social & Communication
- Homepage: the repository link above
- Support site: the issues link above
- License: Apache License 2.0
- Privacy policy: optional (the add-on declares no data collection); can use the PRIVACY.md text.
- Tags: youtube, 7tv, emotes, twitch, chat

**Notes to reviewer**

Plain JavaScript, no bundler or minifier. The package is the `extension/` folder of the repository, zipped by `scripts/build.mjs`, which only adjusts the manifest for Firefox (background scripts instead of a service worker, no `scripting` permission). Source: https://github.com/oozu3/YT-7TV-Client

How to test: open any YouTube live stream with chat, or its chat popout (https://www.youtube.com/live_chat?v=VIDEO_ID&is_popout=1). A dialog asks for a Twitch channel; enter https://www.twitch.tv/ludwig and click Save. Emote names in the chat turn into images. The 7TV tab in the emoji picker and Tab completion need the chat input, which YouTube only shows when signed in.

Network requests: 7tv.io (emote sets and Twitch channel lookup), events.7tv.io (WebSocket for live emote updates), cdn.7tv.app (emote images), api.ivr.fi (fallback Twitch ID lookup), and the YouTube video page on youtube.com (to find the chat's channel). No analytics or tracking. All data is stored in storage.local.
