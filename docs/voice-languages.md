# Voice language coverage

Task 4 supports automatic language detection and preserves the provider transcript in its original language. This concerns voice input; it does not translate the application interface or change the Nigerian demo BoQ.

## Groq Whisper

The primary transcription model is `whisper-large-v3-turbo` on Groq’s Free plan. No language parameter is sent, and the transcription endpoint is used rather than the translation endpoint. Groq’s `verbose_json` detected language name is stored as returned; it is not an accuracy score.

The upstream Whisper tokenizer lists the following 100 language identifiers. This is model vocabulary coverage, not a promise that every accent, dialect, or construction recording is transcribed correctly. Nigerian Pidgin (`pcm`) is not a distinct Whisper identifier; mixed Pidgin/English must be tested with real recordings.

Sources checked 18 November 2026: [Groq speech documentation](https://console.groq.com/docs/speech-to-text) and [upstream Whisper language vocabulary](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py).

| Identifier | Language |
| --- | --- |
| `en` | English |
| `zh` | Chinese |
| `de` | German |
| `es` | Spanish |
| `ru` | Russian |
| `ko` | Korean |
| `fr` | French |
| `ja` | Japanese |
| `pt` | Portuguese |
| `tr` | Turkish |
| `pl` | Polish |
| `ca` | Catalan |
| `nl` | Dutch |
| `ar` | Arabic |
| `sv` | Swedish |
| `it` | Italian |
| `id` | Indonesian |
| `hi` | Hindi |
| `fi` | Finnish |
| `vi` | Vietnamese |
| `he` | Hebrew |
| `uk` | Ukrainian |
| `el` | Greek |
| `ms` | Malay |
| `cs` | Czech |
| `ro` | Romanian |
| `da` | Danish |
| `hu` | Hungarian |
| `ta` | Tamil |
| `no` | Norwegian |
| `th` | Thai |
| `ur` | Urdu |
| `hr` | Croatian |
| `bg` | Bulgarian |
| `lt` | Lithuanian |
| `la` | Latin |
| `mi` | Maori |
| `ml` | Malayalam |
| `cy` | Welsh |
| `sk` | Slovak |
| `te` | Telugu |
| `fa` | Persian |
| `lv` | Latvian |
| `bn` | Bengali |
| `sr` | Serbian |
| `az` | Azerbaijani |
| `sl` | Slovenian |
| `kn` | Kannada |
| `et` | Estonian |
| `mk` | Macedonian |
| `br` | Breton |
| `eu` | Basque |
| `is` | Icelandic |
| `hy` | Armenian |
| `ne` | Nepali |
| `mn` | Mongolian |
| `bs` | Bosnian |
| `kk` | Kazakh |
| `sq` | Albanian |
| `sw` | Swahili |
| `gl` | Galician |
| `mr` | Marathi |
| `pa` | Punjabi |
| `si` | Sinhala |
| `km` | Khmer |
| `sn` | Shona |
| `yo` | Yoruba |
| `so` | Somali |
| `af` | Afrikaans |
| `oc` | Occitan |
| `ka` | Georgian |
| `be` | Belarusian |
| `tg` | Tajik |
| `sd` | Sindhi |
| `gu` | Gujarati |
| `am` | Amharic |
| `yi` | Yiddish |
| `lo` | Lao |
| `uz` | Uzbek |
| `fo` | Faroese |
| `ht` | Haitian Creole |
| `ps` | Pashto |
| `tk` | Turkmen |
| `nn` | Nynorsk |
| `mt` | Maltese |
| `sa` | Sanskrit |
| `lb` | Luxembourgish |
| `my` | Myanmar |
| `bo` | Tibetan |
| `tl` | Tagalog |
| `mg` | Malagasy |
| `as` | Assamese |
| `tt` | Tatar |
| `haw` | Hawaiian |
| `ln` | Lingala |
| `ha` | Hausa |
| `ba` | Bashkir |
| `jw` | Javanese |
| `su` | Sundanese |
| `yue` | Cantonese |

## Gemini fallback

Gemini can process multilingual audio, but its audio documentation does not publish a complete speech-transcription language list or a language-specific accuracy guarantee. It is an optional Free-tier fallback; do not apply the Whisper language list to it. The two earlier live attempts returned HTTP 503, so its fallback availability is not established.

Reference: [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio).

## Tested coverage

- English: the existing Telegram site-intake transcript was processed successfully with Groq extraction on 18 November. It contained no quantities. This checks extraction of a saved transcript, not a new Groq transcription.
- Nigerian English and Pidgin: a builder-recorded Telegram voice note was checked live with Groq on 18 November. The first vocabulary prompt misheard `don` as `don't`, dropping work items. A read-only recheck with the revised Whisper vocabulary preserved `don` and returned 18 m² blockwork, six crew, 2 m³ concrete, 40 cement bags, and a two-hour delay. Concrete crew was omitted because punctuation attached the four workers to the following sentence. `Curing` was still misheard as `clearing`; human confirmation must correct that field.
- Language-detection limitation: Groq labelled this English/Pidgin recording `Yoruba`. The label is preserved as provider metadata, not treated as a reliable determination of the speaker's language. This test does not establish Yoruba transcription accuracy. The final default Turbo pipeline was checked on the builder’s last Telegram recording in a read-only recheck. It returned the expected quantities 18/2, crews 6/4, 40 cement bags, the two-hour delay, and the curing issue, and labelled the recording English. That passes the task 4 function acceptance check; the earlier stored transcript/extraction remain unchanged for human correction in task 5.
- Spanish: an injected saved-transcript unit test checks preservation and schema flow; it is not a live Spanish speech test.
- Other listed languages: no real site recordings have been checked yet.

Whisper Turbo was selected after comparison on the builder’s own recording, where it outperformed the original large-v3 result. The Lekki site name was still rendered as “lake site,” so human review is required even on this successful quantity test. No claim is made that Turbo outperforms large-v3 on every recording.
