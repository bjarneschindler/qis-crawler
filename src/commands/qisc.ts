import puppeteer from "puppeteer";
import logger from "../utils/logger";
import chalk from "chalk";
import asTable from "as-table";

type LectureDetails = {
  name: string;
  grade: number;
  credits: number;
};

const baseUrl = "https://qis.fh-kiel.de/";

// Selectors for various elements on the qis page. Use these to simply construct
// the selectors for the elements we need.
const base = "#wrapper>div.divcontent";
const loginForm = `${base}>div.content_max_portal_qis>div>form`;
const loginButton = `${loginForm} input[type='submit']`;
const usernameInput = `${loginForm} #Benutzerkennung`;
const passwordInput = `${loginForm} #pass`;
const gradesTable = `${base} > div.content > form > table:nth-child(5)`;
const gradesTableRows = `${gradesTable} > tbody > tr`;
const examAdministrationLink = "#makronavigation a[href*='POS']";
const gradesOverviewLink = ".mikronavi_list a[href*='notenspiegel']";
const degreeLink = `${base} > div.content > form > ul > li > a.regular`;
const gradesViewLink = "a[title*='Leistungen anzeigen']";

// Links to the pages we need to visit in order to get the grades.
const linksToGrades = [
  examAdministrationLink,
  gradesOverviewLink,
  degreeLink,
  gradesViewLink,
];

export async function qisc({ verbose }: { verbose?: boolean }) {
  async function login() {
    logger.info(`Logging in as ${user}`);

    await page.waitForSelector(usernameInput);
    await page.type(usernameInput, user);
    await page.type(passwordInput, password);
    await page.click(loginButton);
  }

  async function navigateToGrades() {
    for (let i = 0; i < linksToGrades.length; i++) {
      const link = linksToGrades[i],
        next = linksToGrades[i + 1];

      await page.click(link);
      if (next) await page.waitForSelector(next);
    }
  }

  async function getLectureDetails(): Promise<LectureDetails[]> {
    return await page.$$eval(gradesTableRows, (rows) => {
      const details: LectureDetails[] = [];

      for (const row of rows) {
        const [nameCol, gradeCol, creditsCol] = [2, 7, 10].map((index) =>
          row.querySelector(`td:nth-child(${index})`)
        );

        if (
          !gradeCol ||
          gradeCol.childNodes === undefined ||
          gradeCol.childNodes.length < 2
        ) {
          continue;
        }

        const { childNodes } = gradeCol;
        let temp = childNodes[0].textContent?.trim().replace(",", ".")!;
        const grade = parseFloat(temp);
        const name = nameCol?.textContent?.trim() || "";
        let credits = parseFloat(creditsCol?.textContent?.trim() || "");

        details.push({ name, grade, credits });
      }

      return details;
    });
  }

  const user = process.env.QIS_USER as string;
  const password = process.env.QIS_PASSWORD as string;

  if (!user || !password) {
    logger.error("No crenetials provided.");
    process.exitCode = 1;
    return;
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const [page] = await browser.pages();

  await page.goto(baseUrl);
  await login();
  await navigateToGrades();

  const lectures = await getLectureDetails();
  let data: string | undefined = undefined;

  if (verbose) {
    data = asTable(
      lectures.map(({ name, grade, credits }) => {
        return {
          name,
          grade: chalk.bgGreen.black(` ${grade.toFixed(2)} `),
          ects: chalk.bgGreen.black(`  ${credits} `),
        };
      })
    );
  }

  await browser.close();

  const gradeSum = lectures.map((l) => l.grade).reduce((a, b) => a + b, 0);
  const ectsSum = lectures.map((l) => l.credits).reduce((a, b) => a + b, 0);
  const averageGrade = gradeSum / lectures.length;

  const averageGradeText = chalk.bgGreen.black(` ${averageGrade.toFixed(2)} `);
  const ectsSumText = chalk.bgGreen.black(`  ${ectsSum} `);

  const footer = asTable([
    ["Your grade average is", averageGradeText],
    ["Your total ECTS are", ectsSumText],
  ]);

  data?.split("\n").forEach((line) => logger.info(line));
  footer.split("\n").forEach((line) => logger.info(line));
}
