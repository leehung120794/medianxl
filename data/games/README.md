# Vietnamese game word data

`vietnamese-game-words.json` is generated from `vietnamese-wordlist-source.txt` by running:

```text
node scripts/build-vietnamese-game-data.js
```

Source: [duyet/vietnamese-wordlist — Viet39K.txt](https://github.com/duyet/vietnamese-wordlist/blob/master/Viet39K.txt), compiled from the Free Vietnamese Dictionary Project by Hồ Ngọc Đức.

The source and derived word lists are distributed under the GNU General Public License as stated by the source project. The build script normalizes Unicode, removes duplicates and selects entries suitable for the two Discord word games.
