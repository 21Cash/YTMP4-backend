const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const app = express();
const port = process.env.PORT || 3000;
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

app.use(cors());

function merge(video, audio, res, title) {
  ffmpeg()
    .addInput(video)
    .addInput(audio)
    .addOptions([
      "-map 0:v",
      "-map 1:a",
      "-c:v libx264",
      "-crf 20",
      "-preset fast",
      "-profile:v high",
      "-level 4.2",
      "-c:a aac",
      "-b:a 128k",
      "-strict -2",
    ])
    .save(`${title}.mp4`)
    .on("end", () => {
      console.log("Merging complete");
      res.download(`${title}.mp4`, (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "Error downloading file" });
        }
        fs.unlinkSync(video);
        fs.unlinkSync(audio);
        fs.unlinkSync(`${title}.mp4`);
      });
    })
    .on("error", (err) => {
      console.error("Error merging files:", err);
      res.status(500).json({ error: "Error merging files" });
    });
}

app.get("/download", async (req, res) => {
  try {
    const { url, quality } = req.query;

    console.log(`Quality : ${quality}`);

    if (!url || !quality) {
      console.error("URL and Quality parameters are required");
      return res
        .status(400)
        .json({ error: "URL and Quality parameters are required" });
    }

    console.log(`Fetching video info for ${url}`);
    const videoID = ytdl.getURLVideoID(url);
    let info = await ytdl.getInfo(videoID);

    console.log(`Video title: ${info.videoDetails.title}`);

    const chosenFormat = info.formats.find(
      (format) => format.qualityLabel === quality && format.container === "mp4"
    );

    if (!chosenFormat) {
      return res.status(404).json({ error: "Requested quality not found" });
    }

    console.log(`Downloading video in ${quality}...`);
    const videoStream = ytdl(url, {
      quality: chosenFormat.itag,
    });

    const mp4FilePath = `video_${videoID}.mp4`;
    const mp3FilePath = `audio_${videoID}.mp3`;

    videoStream.pipe(fs.createWriteStream(mp4FilePath));

    console.log(`Downloading audio from the same source...`);
    const audioStream = ytdl(url, {
      quality: "highestaudio",
    });

    audioStream.pipe(fs.createWriteStream(mp3FilePath));

    videoStream.on("end", () => {
      console.log("Downloaded video");
      merge(mp4FilePath, mp3FilePath, res, info.videoDetails.title);
    });
  } catch (err) {
    console.error("Error downloading:", err);
    res.status(500).json({ error: "Error downloading" });
  }
});

app.get("/test", (req, res) => {
  return res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
