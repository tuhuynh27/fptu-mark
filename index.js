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

    const page = await browser.newPage();
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
    await popup.click("#passwordNext");

    // Go to Mark Report
    await page.waitFor('a[href^="Grade/StudentGrade.aspx"]');
    await page.click('a[href^="Grade/StudentGrade.aspx"]');

    // Select subject
    await page.waitFor("[href*='?rollNumber']");

    // Get subject index
    let subIndex;
    listSubject = await page.evaluate(
      ({ id, season }) => {
        const queryString = `[href*='?rollNumber=${id}&term=${season}']`;
        const listSubjectDOM = Array.from(
          document.querySelectorAll(queryString)
        );

        return listSubjectDOM.map(e => e.innerText);
      },
      { id, season }
    );

    console.log("List mon da co diem:");
    listSubject.forEach((e, index) => {
      console.log(`[${index}] - ${e}`);
    });
    if (index || index === 0) {
      subIndex = parseInt(index) || 0;

      if (subIndex === -1) subIndex = listSubject.length - 1;
    } else {
      subIndex = await new Promise(function(resolve) {
        prompt.ask(
          [
            {
              question: `Ban muon xem mon nao, nhap so [0 - ${listSubject.length -
                1}]:`,
              validator: "notNULL",
              name: "index"
            }
          ],
          response => {
            let parseData = parseInt(response.index) || 0;
            if (parseData > listSubject.length - 1 || parseData < 0)
              parseData = 0;

            resolve(parseData);
          }
        );
      });
    }

    try {
      await page.evaluate(
        ({ id, season, subIndex }) => {
          const queryString = `[href*='?rollNumber=${id}&term=${season}']`;
          const listSubjectDOM = document.querySelectorAll(queryString);

          listSubjectDOM[subIndex].click();
        },
        { id, season, subIndex }
      );
    } catch (e) {
      console.log("Co gi do sai sai, khong chon duoc mon, xem lai index thu!");
    }

    // Collect data
    await page.waitFor("table[summary=Report] tr td");
    const data = await page.evaluate(() => {
      const tds = Array.from(
        document.querySelectorAll("table[summary=Report] tr td")
      );
      return tds.map(td => td.innerHTML);
    });

    // Print result
    const result = data.slice(Math.max(data.length - 30, 1));

    const statusHTML = result[result.length - 1];
    const status = statusHTML.replace(/<(?:.|\n)*?>/gm, "");
    const average = result[result.length - 3];
    const finalFirst = result[result.length - 16] || "Not yet";
    const finalSecond = result[result.length - 7] || "Not yet";

    console.log(
      `\nDiem cua ${email}, mon ${listSubject[subIndex]}, ki ${season}`
    );
    console.log("====================");
    console.log("Final: ", finalFirst);
    console.log("Retake: ", finalSecond);
    console.log("Average: ", average);
    console.log("Status: ", status);
    console.log("====================");

    const slackStr = `Điểm của *${email}*, môn *${
      listSubject[subIndex]
    }*, kì *${season}* là:
    
Final: ${finalFirst}
Retake: ${finalSecond}
Average: ${average}
Status: ${status}

*Update mỗi 15p nha, yên tâm chờ tiếp.* :kissing:
    `;

    axios.post(
      "https://hooks.slack.com/services/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",
      {
        text: slackStr
      }
    );

    await browser.close();
  } catch (e) {}
})();
