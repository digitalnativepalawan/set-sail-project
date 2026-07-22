# Fix TALA voice lag

## What's causing the lag

The lag is in `src/components/tala/useTalaVoice.ts`, not the network. Kokoro-82M runs entirely in the browser on CPU (WASM, q8). Today the pipeline is strictly sequential:

```text
LLM reply arrives
   └─ split into sentences
        └─ generate sentence 1  ── wait ──►  play sentence 1
                                                └─ generate sentence 2 ── wait ──► play sentence 2
                                                                                       └─ ...
```

So the delay before TALA starts talking = full synthesis time of the first sentence, and every gap between sentences = full synthesis time of the next one. On a modest laptop that's easily 1–3 s per sentence — which is what "lag" feels like even on fast internet.

Two other smaller contributors:
- Kokoro only starts downloading when voice is first toggled on / the first reply arrives, so the very first reply can also wait on the 80 MB model download.
- `dtype: "q8"` is the heaviest of Kokoro's quantized weights on CPU; `q4` / `q4f16` are noticeably faster with negligible quality loss for a concierge voice.

## The fix

Change is scoped to `src/components/tala/useTalaVoice.ts` only — no UI, copy, or server changes.

1. **Pipeline synthesis with playback.** Keep a small look-ahead: while sentence N is playing, generate sentence N+1 in the background. First-sentence latency is unchanged (that's a hard floor), but every subsequent sentence starts instantly instead of after a gap. Concretely, replace the "generate → play → generate → play" loop with two coordinated tasks:
   - a producer that pulls the next queued chunk, calls `kokoro.generate`, and pushes the resulting WAV blob URL into a small ready-queue (cap 2 so memory stays bounded),
   - a consumer that pops the next ready blob and plays it via the existing `<audio>` element.
   Both honour the existing `generationRef` cancellation token so `stop()` still cuts everything cleanly, and the browser-speech fallback path is left untouched.

2. **Shorten the first chunk.** Update `splitSentences` so the *first* returned chunk is allowed to be short (drop the "merge short fragments" rule for index 0). A short opening clause ("Hi! Sure —") synthesizes in a fraction of the time of a full sentence, so TALA starts talking sooner; the rest of the reply keeps the current natural chunking.

3. **Pre-warm Kokoro earlier.** Kick off `KokoroTTS.from_pretrained` as soon as the TALA widget mounts with voice enabled, instead of waiting for the first reply. The model then downloads/initialises in parallel with the user reading the greeting and typing, so by the time the first assistant reply arrives it's usually ready. `pendingSpeakRef` / `KOKORO_WAIT_CAP_MS` behaviour is unchanged.

4. **Switch quantization to `q4f16`.** Change the `KokoroTTS.from_pretrained` options from `dtype: "q8"` to `dtype: "q4f16"`. Smaller download, meaningfully faster CPU inference, quality difference is not audible on a concierge voice. If a browser rejects that dtype, fall back to `q8` in the same catch block that today falls back to browser voices.

## Out of scope (kept as-is)

- Web Speech fallback, voice picker, admin default voice, `stop()` semantics, `pendingSpeakRef` wait cap, PCM16 WAV encoder, chat/LLM path.
- No new dependency, no server work, no config change.

## Verification

- Load `/`, open TALA, ask a multi-sentence question. Expect: audible speech within ~1 s of the reply text appearing, and no silent gap between sentences.
- Toggle voice off/on mid-reply — playback should still cut immediately.
- Hard-reload with cache cleared — first visit's first reply is still slower (model download), but the second reply onward is snappy; second visit onward is snappy from the first reply.
