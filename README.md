# ondevice-llm


# Changes needs to be done 


3. Microphone Functionality is missing here . kindly add that. Kindly check the multimodel use of prompt api bellow 

```const session = await LanguageModel.create({
  expectedInputs: [
    { type: "text", languages: ["en"] },
    { type: "audio" },
    { type: "image" },
  ],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
});

const referenceImage = await (await fetch("reference-image.jpeg")).blob();
const userDrawnImage = document.querySelector("canvas");

const response1 = await session.prompt([
  {
    role: "user",
    content: [
      {
        type: "text",
        value:
          "Give a helpful artistic critique of how well the second image matches the first:",
      },
      { type: "image", value: referenceImage },
      { type: "image", value: userDrawnImage },
    ],
  },
]);
console.log(response1);

const audioBuffer = await captureMicrophoneInput({ seconds: 10 });

const response2 = await session.prompt([
  {
    role: "user",
    content: [
      { type: "text", value: "My response to your critique:" },
      { type: "audio", value: audioBuffer },
    ],
  },
]);
console.log(response2);
```
2. 