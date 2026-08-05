# Project Nexus — Zero Third-Party AI Policy

**Status: ENFORCED** · Slice 15.12 · A+ Hard Gate

## Forbidden (must never appear in source or dependency manifests)

| Package / API | Replacement |
|---------------|-------------|
| ONNX Runtime / `onnx` | `frontier/ai/neural_engine.frontier` |
| OpenAI API / `openai` | `frontier/ai/language_model.frontier` |
| Anthropic / Claude API | `FrontierLM.generate()` |
| PyTorch / `torch` | Frontier `Tensor` + `Autograd` |
| TensorFlow / `tensorflow` | Frontier `Tensor` + layers |
| Hugging Face / `transformers` | Frontier `Tokenizer` (BPE) |
| GitHub Copilot | `FrontierAI.generate_code()` |
| llama.cpp / ggml | Frontier Neural Engine |

## Allowed (Frontier-native / std only)

- Frontier standard library
- Frontier Neural Engine, Language Model, Applications, Training
- Frontier LZ compression (`NativeCompression`)
- No network calls for inference

## Verification

```bash
python3 build/arc_orchestrator.py --patch purge-third-party
python3 build/arc_orchestrator.py --slides 15.9,15.10,15.11,15.12
rg -i 'onnx|openai|tensorflow|pytorch|huggingface|anthropic' . --glob '!.git'
# Expected: empty (except this policy doc + audit reports)
```
