const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const app = express();
const port = process.env.PORT || 3000;
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const { format } = require("path");

app.use(cors());

app.get("/formats", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    console.error("URL parameters are required");
    return res
      .status(400)
      .json({ error: "URL and Quality parameters are required" });
  }

  console.log(`Fetching video Formats for ${url}`);
  const videoID = ytdl.getURLVideoID(url);
  let info = await ytdl.getInfo(videoID);
  console.log("Formats Fetched.");
  return res.status(200).send(info.formats);
});

function merge(video, audio, title, res) {
  try {
    ffmpeg()
      .addInput(video)
      .addInput(audio)
      .addOptions(["-map 0:v", "-map 1:a", "-c:v copy", "-c:a aac"])
      .save("merged.mp4")
      .on("end", () => {
        console.log("Merging complete");
        const fileName = `${title}.mp4`;
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
  } catch (error) {
    console.error("Merge function error:", error);
    res.status(500).json({ error: "Error in merging process" });
  }
}

app.get("/fastdownload", async (req, res) => {
  try {
    const { url, itag } = req.query;

    if (!url || !itag) {
      return res.status(400).send("URL and itag parameters are required.");
    }

    console.log(`FastDownload Req for ${url}, itag : ${itag}`);

    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title;

    const format = info.formats.find(
      (format) => format.itag === parseInt(itag)
    );

    if (!format) {
      return res
        .status(404)
        .send("Video format not found for the provided itag.");
    }

    res.header(
      "Content-Disposition",
      `attachment; filename="${videoTitle}.${format.container}"`
    );
    res.header("Content-Type", format.mimeType);

    console.log("File Download Started.");

    ytdl(url, { quality: format.itag }).pipe(res);

    res.on("finish", () => {
      console.log("Fast Download File Sent Successfully.");
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

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

    const chosenFormat = info.formats.find(
      (format) => format.qualityLabel === quality
    );

    if (!chosenFormat) {
      return res.status(404).json({ error: "Requested quality not found" });
    }

    const videoTitle = info.videoDetails.title;
    console.log(`Video title: ${videoTitle}`);

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
      merge(mp4FilePath, mp3FilePath, videoTitle, res);
    });
  } catch (error) {
    console.error("Download endpoint error:", error);
    res.status(500).json({ error: "Error in download process" });
  }
});

app.get("/test", (req, res) => {
  return res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
