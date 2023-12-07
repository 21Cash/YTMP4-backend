const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const app = express();
const port = process.env.PORT || 3000;
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

app.use(
  cors({
    origin: "*",
  })
);

app.get("/formats", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      console.error("URL parameters are required");
      return res
        .status(400)
        .json({ error: "URL and Quality parameters are required" });
    }

    console.log(`Fetching video info for ${url}`);
    const videoID = ytdl.getURLVideoID(url);
    let info = await ytdl.getInfo(videoID);

    return res.status(200).send(info.formats);
  } catch (err) {
    console.error("Error fetching video info:", err);
    return res.status(500).json({ error: "Error fetching video info" });
  }
});

function merge(title, video, audio, res) {
  console.log("Merging Started.");
  ffmpeg()
    .addInput(video)
    .addInput(audio)
    .addOptions(["-map 0:v", "-map 1:a", "-c:v copy", "-c:a aac"])
    .save("merged.mp4")
    .on("end", () => {
      const fileName = `${title}.mp4`;
      console.log("Merging complete.");
      res.download("merged.mp4", fileName, (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "Error downloading file" });
        }
        // Cleanup: Delete temporary files
        fs.unlinkSync(video);
        fs.unlinkSync(audio);
        fs.unlinkSync("merged.mp4");
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

    const videoTitle = info.videoDetails.title;
    console.log(`Video title: ${videoTitle}`);

    const chosenFormat = info.formats.find(
      (format) => format.qualityLabel === quality
    );

    if (!chosenFormat) {
      return res.status(404).json({ error: "Requested quality not found" });
    }

    console.log(`Downloading video in ${chosenFormat.qualityLabel}...`);
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

    audioStream.on("end", () => {
      console.log("Audio File Downloaded.");
    });

    audioStream.pipe(fs.createWriteStream(mp3FilePath));

    videoStream.on("end", () => {
      console.log("Downloaded video");
      merge(videoTitle, mp4FilePath, mp3FilePath, res);
    });
  } catch (err) {
    console.error("Error downloading video:", err);
    return res.status(500).json({ error: "Error downloading video" });
  }
});

app.get("/test", (req, res) => {
  return res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
