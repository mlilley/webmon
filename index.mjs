import xpathhtml from 'xpath-html';
import dayjs from 'dayjs';
import got from 'got';
import fs from 'fs';
import cp from 'child_process';
import { createRequire } from "module";

const PAGES = createRequire(import.meta.url)('./pages.json');
const STORE_PATH = './store';
const DIFFCMD = 'diff';

function getPageDir(page) {
    return STORE_PATH + '/' + page.id;
}

function getDiffDir(page, dt) {
    return STORE_PATH + '/' + page.id;
}

function getPageFile(page, dt) {
    return dt.format('YYYYMMDD') + '_' + dt.format('HHmmss') + '.dat';
}

function getDiffFile(page, dt) {
    return dt.format('YYYYMMDD') + '_' + dt.format('HHmmss') + '.diff';
}

async function fetchPage(page) {
    let response;
    try {
        response = await got(page.url);
    } catch (err) {
        return { ok: false, msg: err.message };
    }
    if (!(response.statusCode == 200 && response.statusCode < 300)) {
        return { ok: false, msg: response.statusCode.toString() };
    }
    return { ok: true, responseBody: response.body };
}

function extractSections(page, pageContent) {
    const sections = [];
    if (page.xpaths && page.xpaths.length) {
        try {
            const parsedContent = xpathhtml.fromPageSource(pageContent);
            for (const x of page.xpaths) {
                const section = parsedContent.findElement(x).toString();
                sections.push(section);
            }
        } catch (err) { 
            return { ok: false, msg: err.message }
        }
    }
    return { ok: true, content: sections.join(',') };
}

function loadPage(pagePath) {
    if (pagePath == null) {
        return null;
    }
    if (!fs.existsSync(pagePath)) {
        return null;
    }
    const content = fs.readFileSync(pagePath);
    return content;
}

function storePage(page, dt, content) {
    const pageDir = getPageDir(page);
    const pageFile = getPageFile(page, dt);
    const pagePath = pageDir + '/' + pageFile;
    try {
        fs.mkdirSync(pageDir, { recursive: true });
        fs.writeFileSync(pagePath, content);
    } catch (err) {
        return { ok: false, msg: err.msg };
    }
    return { ok: true, path: pagePath };
}

function storeDiff(page, dt, content) {
    const diffDir = getDiffDir(page);
    const diffFile = getDiffFile(page, dt);
    const diffPath = diffDir + '/' + diffFile;
    try {
        fs.mkdirSync(diffDir, { recursive: true });
        fs.writeFileSync(diffPath, content);
    } catch (err) {
        return { ok: false, msg: err.msg };
    }
    return { ok: true, path: diffPath };
}

function findPageInitialFile(page) {
    const pageDir = getPageDir(page);
    if (!fs.existsSync(pageDir)) {
        return null;
    }
    const files = fs.readdirSync(pageDir).sort().filter(f => f.endsWith('.dat'));
    if (files.length) {
        return pageDir + '/' + files[0];
    }
    return null;
}

function diffPage(aPath, bPath) {
    let output;
    try {
        output = cp.execSync(DIFFCMD + " '" + aPath + "' '" + bPath + "'");
    } catch (err) {
        return { ok: true, diff: err.stdout.toString('utf8') };
    }
    return { ok: true, diff: output.toString('utf8') };
}

async function go(page) {
    let result;
    const dt = dayjs();

    result = await fetchPage(page);
    if (!result.ok) {
        return { ok: false, msg: 'Fetch failed: ' + result.msg };
    }

    result = extractSections(page, result.responseBody);
    if (!result.ok) {
        return { ok: false, msg: 'Extract failed: ' + result.msg };
    }

    result = storePage(page, dt, result.content);
    if (!result.ok) {
        return { ok: false, msg: 'Store page failed: ' + result.msg };
    }
    const pagePath = result.path;

    const initialPath = findPageInitialFile(page);
    if (initialPath == null) {
        return { ok: false, msg: 'Initial page not found' };
    }
    if (initialPath == pagePath) {
        return { ok: true, msg: 'Inital page captured' };
    }

    result = diffPage(initialPath, pagePath);
    if (!result.ok) {
        return { ok: false, msg: 'Diffing failed: ' + result.msg };
    }
    const diff = result.diff;

    result = storeDiff(page, dt, diff);
    if (!result.ok) {
        return { ok: false, msg: 'Store diff failed: ' + result.msg };
    }
    const diffPath = result.path;

    return { ok: true, msg: (diff == '' ? 'No change' : 'CHANGE! - ' + diffPath) };
}

for (const page of PAGES) {
    const result = await go(page);
    console.log(page.id + ': ' + result.msg);
}
