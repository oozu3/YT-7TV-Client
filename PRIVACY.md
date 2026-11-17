# Privacy policy

*Last updated: November 17, 2026*

YT 7TV Client is an open-source browser extension. It has no servers, accounts, analytics, ads or tracking of its own, and it does not sell or share data with anyone.

## What is stored

Everything is stored locally in your browser (`storage.local`) and never leaves your device:

- your settings (language, which features are on);
- which Twitch channel you picked for each YouTube channel (identified by the YouTube channel ID or handle);
- a saved copy of the emote sets in use, so emotes show up right away (up to 6 sets);
- the last YouTube theme seen (light or dark), so the popup matches it.

You can remove saved channels in the extension's settings. Uninstalling the extension deletes all of it.

## What the extension reads

Inside YouTube's live chat, the extension reads the text of chat messages and the names of the people talking, so it can turn emote names into images and complete names with Tab. This is processed in memory, on your device, and is not stored or sent anywhere.

To find out which channel a chat belongs to, the extension loads the YouTube page of the video being watched, from youtube.com.

## Requests to other services

The extension only talks to these services, and only to do its job:

| Service | What is sent | Why |
| --- | --- | --- |
| **7TV** (`7tv.io`, `events.7tv.io`) | The Twitch channel name or ID you picked, the YouTube channel ID of the stream, and emote set IDs | Load the emote sets, suggest a Twitch channel when the streamer linked their YouTube channel on 7TV, and receive live emote updates |
| **7TV CDN** (`cdn.7tv.app`) | Requests for emote images | Show the emotes |
| **ivr.fi** (`api.ivr.fi`) | The Twitch channel name you picked | Look up the Twitch channel ID if the 7TV lookup fails |

No personal information (such as your name, email, YouTube account or messages) is sent to these services. Like any website request, they can see your IP address. Their own privacy policies apply.

## Changes

Changes to this policy are published in this file, and its history is public in this repository.

## Contact

Open an issue at <https://github.com/oozu3/YT-7TV-Client/issues>.

---

# Política de privacidade (português)

*Atualizada em 17 de novembro de 2026*

O YT 7TV Client é uma extensão de código aberto. Ela não tem servidor, conta, análise de uso, anúncios nem rastreamento próprios, e não vende nem compartilha dados com ninguém.

**O que fica salvo**, só no seu navegador (`storage.local`), sem sair do seu dispositivo: as configurações; qual canal da Twitch você escolheu para cada canal do YouTube; uma cópia dos sets de emotes em uso (até 6); e o último tema do YouTube visto. Desinstalar a extensão apaga tudo.

**O que ela lê:** dentro do chat ao vivo do YouTube, o texto das mensagens e o nome de quem fala, para trocar nomes de emotes por imagens e completar nomes com Tab. Isso é processado na memória, no seu dispositivo, e não é salvo nem enviado. Para saber de qual canal é o chat, ela carrega a página do vídeo no youtube.com.

**Pedidos a outros serviços:** a 7TV (`7tv.io`, `events.7tv.io`, `cdn.7tv.app`) recebe o nome ou ID do canal da Twitch escolhido, o ID do canal do YouTube da live e os IDs dos sets, para carregar os emotes, sugerir o canal da Twitch e receber atualizações em tempo real. O `api.ivr.fi` recebe o nome do canal da Twitch, só se a busca da 7TV falhar. Nenhuma informação pessoal (nome, e-mail, conta do YouTube ou mensagens) é enviada. Como em qualquer acesso a um site, esses serviços veem o seu endereço IP.

**Contato:** abra uma issue em <https://github.com/oozu3/YT-7TV-Client/issues>.
