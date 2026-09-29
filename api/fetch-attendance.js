const cheerio = require('cheerio');

/**
 * Helper to handle cookies & requests across ASP.NET redirects
 */
async function fetchWithCookies(url, options = {}, cookieJar = {}) {
  const headers = options.headers || {};
  
  const cookieString = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
    
  if (cookieString) {
    headers['Cookie'] = cookieString;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual'
  });

  const setCookieHeaders = response.headers.getSetCookie 
    ? response.headers.getSetCookie() 
    : [response.headers.get('set-cookie')].filter(Boolean);

  setCookieHeaders.forEach(cookieStr => {
    if (!cookieStr) return;
    const parts = cookieStr.split(';')[0].split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key) cookieJar[key] = val;
    }
  });

  return { response, cookieJar };
}

/**
 * Universal Attendance Parser for AGC LMS HTML
 */
function parseSubjectsFromHtml(html) {
  const $ = cheerio.load(html);
  const subjects = [];
  const seenNames = new Set();

  function addSubject(name, total, attended, code = 'N/A') {
    if (!name || total <= 0) return;
    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (cleanName.length < 3 || seenNames.has(cleanName.toLowerCase())) return;
    if (/^(subject|course|sr\.?no|serial|action|details?|view|total|attended|percentage|present|absent|status|mentorship)$/i.test(cleanName)) return;

    seenNames.add(cleanName.toLowerCase());
    subjects.push({
      id: '_' + Math.random().toString(36).slice(2, 10),
      name: cleanName,
      code: code.trim() || 'N/A',
      total: Math.max(total, attended),
      attended: Math.min(attended, total)
    });
  }

  $('table').each((_, table) => {
    $(table).find('tr').each((_, row) => {
      const cells = $(row).find('td, th').map((_, cell) => $(cell).text().trim()).get();
      if (cells.length < 2) return;

      const rowText = cells.join(' ');
      if (!/\d/.test(rowText)) return;

      let subjectName = '';
      let subjectCode = 'N/A';
      let totalClasses = 0;
      let attendedClasses = 0;

      cells.forEach(col => {
        const fracMatch = col.match(/(\d{1,3})\s*[/:\\\s]*(\d{1,3})/);
        if (fracMatch) {
          const numA = parseInt(fracMatch[1]);
          const numB = parseInt(fracMatch[2]);
          attendedClasses = Math.min(numA, numB);
          totalClasses = Math.max(numA, numB);
        }
      });

      const numericCols = [];
      cells.forEach(col => {
        if (/^[A-Z]{2,4}\s*[-]?\s*\d{3,4}(?:-\d{2})?$/i.test(col)) {
          subjectCode = col;
        } else if (!subjectName && /[a-zA-Z]{3,}/.test(col) && !/^(present|absent|total|attended|percentage|status|view|action|sr\.?no|\d+)$/i.test(col)) {
          subjectName = col;
        }

        const cleanVal = col.replace(/%/g, '').trim();
        const num = parseInt(cleanVal);
        if (!isNaN(num) && num >= 0 && num < 500) {
          numericCols.push(num);
        }
      });

      if (totalClasses === 0 && numericCols.length >= 2) {
        const sorted = numericCols.filter(n => n <= 200).sort((a, b) => b - a);
        if (sorted.length >= 2) {
          totalClasses = sorted[0];
          attendedClasses = sorted[1];
        }
      }

      if (subjectName && totalClasses > 0) {
        addSubject(subjectName, totalClasses, attendedClasses, subjectCode);
      }
    });
  });

  $('.card, .box, .subject-card, .attendance-card, .list-group-item, .col-md-4, .col-md-6, .col-md-3').each((_, el) => {
    const text = $(el).text();
    const title = $(el).find('h3, h4, h5, h6, .card-title, strong, b').first().text().trim();
    if (!title || seenNames.has(title.toLowerCase())) return;

    const fracMatch = text.match(/(\d{1,3})\s*[/:\\\s]*(\d{1,3})/);
    if (fracMatch) {
      const n1 = parseInt(fracMatch[1]);
      const n2 = parseInt(fracMatch[2]);
      addSubject(title, Math.max(n1, n2), Math.min(n1, n2));
    }
  });

  return subjects;
}

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }
  const { rollNumber, password } = body || {};

  if (!rollNumber || !password) {
    return res.status(400).json({ success: false, message: 'Roll Number and Password are required.' });
  }

  try {
    const cookieJar = {};
    const baseUrl = 'https://agclms.in';
    const loginUrl = `${baseUrl}/Elogin/StudentLogin`;

    console.log(`[AGC-LMS API] Initiating login flow for roll number: ${rollNumber}`);

    // Step 1: GET Login Page
    const { response: initialRes } = await fetchWithCookies(loginUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    }, cookieJar);

    const initialHtml = await initialRes.text();
    const $login = cheerio.load(initialHtml);

    const token = $login('input[name="__RequestVerificationToken"]').val();
    
    let rollFieldName = 'StudentId';
    let passFieldName = 'Password';

    $login('input').each((_, el) => {
      const name = $login(el).attr('name') || '';
      const type = $login(el).attr('type') || '';
      if (/StudentId|UnivRollNo|RollNo|Username/i.test(name) && type !== 'hidden') {
        rollFieldName = name;
      }
      if (/pass/i.test(name) || type === 'password') {
        passFieldName = name;
      }
    });

    // Build POST body
    const formData = new URLSearchParams();
    if (token) formData.append('__RequestVerificationToken', token);
    formData.append(rollFieldName, rollNumber);
    formData.append(passFieldName, password);

    // Step 2: POST credentials
    const { response: postRes } = await fetchWithCookies(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': loginUrl
      },
      body: formData.toString()
    }, cookieJar);

    const postHtml = await postRes.text();
    const $post = cheerio.load(postHtml);

    const hasPasswordInput = $post('input[type="password"]').length > 0;
    const errorText = $post('.text-danger, .field-validation-error, .alert-danger, #error').text().trim();

    if (hasPasswordInput || postHtml.includes('Invalid') || postHtml.includes('Incorrect') || postHtml.includes('not exist')) {
      const msg = errorText || 'Invalid Student ID or Password on agclms.in. Please verify your AGC LMS login details.';
      return res.status(401).json({ success: false, message: msg });
    }

    // Determine redirect
    let targetUrl = postRes.headers.get('location');
    if (targetUrl) {
      if (!targetUrl.startsWith('http')) {
        targetUrl = baseUrl + (targetUrl.startsWith('/') ? '' : '/') + targetUrl;
      }
    } else {
      targetUrl = `${baseUrl}/DashBoardStudent`;
    }

    // Step 3: Fetch dashboard
    let { response: dashRes } = await fetchWithCookies(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': loginUrl
      }
    }, cookieJar);

    if (dashRes.status === 302 || dashRes.status === 301) {
      let loc = dashRes.headers.get('location');
      if (loc) {
        if (!loc.startsWith('http')) loc = baseUrl + (loc.startsWith('/') ? '' : '/') + loc;
        const secondFetch = await fetchWithCookies(loc, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }, cookieJar);
        dashRes = secondFetch.response;
      }
    }

    let dashHtml = await dashRes.text();
    let $dash = cheerio.load(dashHtml);

    // Extract student name
    let studentName = '';
    const fullText = $dash.text();
    const nameMatch = fullText.match(/(?:Student\s*Name)\s*[:=-]?\s*([A-Za-z\s.]{3,35})/i);
    if (nameMatch && nameMatch[1]) {
      const candidate = nameMatch[1].trim();
      if (!/detail|mentorship|dashboard|attendance|report|logout|login|portal|total|attended|code|roll|home|welcome|menu|navigation|incharge|mentor|faculty|teacher|hod|dr|prof|coordinator/i.test(candidate)) {
        studentName = candidate;
      }
    }

    if (!studentName) {
      $dash('#lblStudentName, #studentName, .student-name, .profile-name, .user-name, .welcome-text, .user-info, h1, h2, h3, h4, h5, td, span, strong').each((_, el) => {
        if (studentName) return;
        const txt = $dash(el).text().trim();
        if (/student\s*name\s*[:=-]/i.test(txt)) {
          const val = txt.replace(/^.*student\s*name\s*[:=-]\s*/i, '').trim();
          if (val && val.length >= 3 && !/detail|mentorship|dashboard|attendance|report|home|welcome|incharge|mentor|faculty|teacher|hod/i.test(val)) {
            studentName = val;
          }
        }
      });
    }

    if (!studentName) {
      $dash('tr, .row, .form-group').each((_, row) => {
        if (studentName) return;
        const label = $dash(row).find('td:first-child, th:first-child, label').text().trim();
        if (/student\s*name/i.test(label)) {
          const val = $dash(row).find('td:last-child, .col-md-8, span, div').last().text().trim();
          if (val && val.length >= 3 && !/detail|mentorship|dashboard|attendance|home|welcome|incharge|mentor|faculty|teacher|hod/i.test(val)) {
            studentName = val;
          }
        }
      });
    }

    if (!studentName || /detail|mentorship|home|dashboard|welcome|portal|incharge|mentor|faculty|teacher|hod|student\s*\(/i.test(studentName)) {
      studentName = `Student ${rollNumber}`;
    }

    // Collect subject report links
    const reportLinks = [];
    $dash('a[href]').each((_, el) => {
      const href = $dash(el).attr('href') || '';
      const text = $dash(el).text().trim();
      
      const parentRow = $dash(el).closest('tr');
      const parentCard = $dash(el).closest('.card, .box, .col-md-4, .col-md-6, .col-md-3, div');

      let rowText = '';
      if (parentRow.length > 0) {
        const cols = parentRow.find('td, th').map((_, cell) => $dash(cell).text().trim()).get();
        rowText = cols.join(' | ');
      } else if (parentCard.length > 0) {
        rowText = parentCard.text().replace(/\s+/g, ' ').trim();
      }

      if (href && (href.includes('AttendanceReport') || href.toLowerCase().includes('attend'))) {
        reportLinks.push({ href, text, rowText });
      }
    });

    // Fetch each subject's report page
    const subjectFetchPromises = reportLinks.slice(0, 15).map(async (item, idx) => {
      let url = item.href;
      if (!url.startsWith('http')) {
        url = baseUrl + (url.startsWith('/') ? '' : '/') + url;
      }
      try {
        const reportRes = await fetchWithCookies(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': targetUrl
          }
        }, cookieJar);
        const reportHtml = await reportRes.response.text();
        const $rep = cheerio.load(reportHtml);

        let subjectName = '';
        let subjectCode = 'N/A';

        if (item.text && item.text.length >= 3 && !/^(view|report|click|details?|attendance|view report|here|see)$/i.test(item.text)) {
          subjectName = item.text;
        }

        if (!subjectName && item.rowText) {
          const parts = item.rowText.split('|').map(p => p.trim());
          parts.forEach(part => {
            if (!subjectName && /[a-zA-Z]{3,}/.test(part) && !/^(view|report|click|details?|attendance|view report|sr\.?no|serial|action|present|absent|total|status|\d+)$/i.test(part)) {
              subjectName = part;
            }
            if (subjectCode === 'N/A' && /^[A-Z]{2,4}\s*[-]?\s*\d{3,4}/i.test(part)) {
              subjectCode = part;
            }
          });
        }

        if (!subjectName || subjectName.length < 3) {
          $rep('h1, h2, h3, h4, h5, .card-title, .box-title, th, td, label, p, span').each((_, el) => {
            const txt = $rep(el).text().trim();
            if (!subjectName && /[a-zA-Z]{3,}/.test(txt) && !/attendance|report|student|dashboard|welcome|detail|summary|present|absent|total|status/i.test(txt)) {
              if (txt.length >= 3 && txt.length <= 60) {
                subjectName = txt;
              }
            }
            if (subjectCode === 'N/A' && /^[A-Z]{2,4}\s*[-]?\s*\d{3,4}/i.test(txt)) {
              subjectCode = txt;
            }
          });
        }

        if (subjectName) {
          subjectName = subjectName.replace(/^(subject|course|name|details?|title)\s*[:=-]?\s*/i, '').replace(/\s+/g, ' ').trim();
        }
        if (!subjectName || subjectName.length < 2) {
          subjectName = `Subject ${idx + 1}`;
        }

        let total = 0;
        let attended = 0;

        const pageText = $rep.text();
        const totalMatch = pageText.match(/(?:Total|Delivered|Classes)\s*[:=-]?\s*(\d{1,3})/i);
        const presentMatch = pageText.match(/(?:Present|Attended)\s*[:=-]?\s*(\d{1,3})/i);

        if (totalMatch && presentMatch) {
          total = parseInt(totalMatch[1]);
          attended = parseInt(presentMatch[1]);
        } else {
          $rep('table tr').each((_, tr) => {
            const rowStr = $rep(tr).text().toLowerCase();
            if (rowStr.includes('present') || /\b[p]\b/.test(rowStr)) {
              attended++;
              total++;
            } else if (rowStr.includes('absent') || /\b[a]\b/.test(rowStr)) {
              total++;
            }
          });
        }

        if (total === 0) {
          const frac = pageText.match(/(\d{1,3})\s*[/:\\\s]*(\d{1,3})/);
          if (frac) {
            attended = parseInt(frac[1]);
            total = parseInt(frac[2]);
          }
        }

        const dailyRecords = [];
        $rep('table tr').each((i, tr) => {
          const cells = $rep(tr).find('td').map((_, c) => $rep(c).text().trim()).get();
          if (cells.length >= 2) {
            const rowStr = cells.join(' ');
            let status = '';
            if (/present|\b[p]\b/i.test(rowStr)) status = 'Present';
            else if (/absent|\b[a]\b/i.test(rowStr)) status = 'Absent';

            if (status) {
              const dateMatch = rowStr.match(/(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/);
              const date = dateMatch ? dateMatch[1] : cells[0] || `Day ${dailyRecords.length + 1}`;
              const topic = cells.find(c => c.length > 4 && !c.includes(date) && !/present|absent/i.test(c)) || `Lecture ${dailyRecords.length + 1}`;
              dailyRecords.push({
                lectureNo: dailyRecords.length + 1,
                date: date,
                status: status,
                topic: topic
              });
            }
          }
        });

        if (total > 0) {
          return {
            id: '_' + Math.random().toString(36).slice(2, 10),
            name: subjectName,
            code: subjectCode,
            total: Math.max(total, attended),
            attended: Math.min(attended, total),
            dailyRecords: dailyRecords
          };
        }
      } catch (err) {
        console.warn(`[AGC-LMS API] Failed to fetch subject report ${url}:`, err.message);
      }
      return null;
    });

    const reportSubjects = (await Promise.all(subjectFetchPromises)).filter(Boolean);
    const universalSubjects = parseSubjectsFromHtml(dashHtml);
    const subjects = reportSubjects.length > 0 ? reportSubjects : universalSubjects;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.json({
      success: true,
      studentName: studentName !== 'Student' ? studentName : `Student (${rollNumber})`,
      rollNumber,
      subjects,
      isRealData: true
    });

  } catch (error) {
    console.error('[AGC-LMS API Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to AGC LMS portal: ' + error.message
    });
  }
};
