# ondevice-llm


# Changes needs to be done 

1. in Assistance bubble time stamp appear immadiately , even thogh llm is thinking , it should show the time stamp of end of chnuk received .

2. Make sure All the Svg icons has same color , line width and FE and BE color it shoudl look uni form 

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

5. uses this svg icon for Image Attachemt . Al so in tool tip mentioned that PNG or jpg is allowed.

<svg width="256px" height="256px" viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="style=linear"> <g id="attach"> <path id="vector" d="M20.6475 10.6158L11.8855 19.3778C9.93289 21.3304 6.76706 21.3304 4.81444 19.3778C2.86182 17.4252 2.86182 14.2594 4.81444 12.3068L12.9462 4.17503C14.313 2.80819 16.5291 2.80819 17.8959 4.17503C19.2628 5.54186 19.2628 7.75794 17.8959 9.12478L10.1024 16.9183C9.32132 17.6994 8.05499 17.6994 7.27394 16.9183C6.4929 16.1373 6.49289 14.8709 7.27394 14.0899L14.468 6.89585" stroke="#000000" stroke-width="1.056" stroke-linecap="round"></path> </g> </g> </g></svg>