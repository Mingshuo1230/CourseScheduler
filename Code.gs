// ======= SERVER-SIDE CODE =======

// Spreadsheet & sheet names
const SS_ID         = '1xOlEs12FjJha8Z1z3sEZpEc0U1mQ5F5_FW3YZ5q_JMg';
const STUDENT_SHEET = 'Students';
const TEACHERS_SHEET= 'Teachers';
const MEET_SHEET    = 'Meetings';
const COURSE_SHEET = 'Courses';
const LOCATION_SHEET = 'Locations';
const AVAILABILITY_SHEET = 'TeacherAvailability';


// ——— Utility to clean up any surrounding quotes on an ID ——————————
function _sanitizeId(raw) {
  return (raw||'').toString().replace(/^"+|"+$/g, '');
}


// Helper function to ensure month is in YYYY-MM format
function formatMonth(month) {
  if (!month) return "";
  
  // If it's already in YYYY-MM format, return as is
  if (month.includes('-')) return month;
  
  // If it's just a number (like "8"), convert to current year
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${month.padStart(2, '0')}`;
}




// ======== Web App Entry Point ========
function doGet(e) {
  const mode = e.parameter.mode;
  const id   = e.parameter.id;

  if (mode === 'admin') {
    return HtmlService.createHtmlOutputFromFile('Admin')
      .setTitle('Admin');
  }
  if (mode === 'adminTeacher') {
    return HtmlService.createHtmlOutputFromFile('AdminTeacher')
      .setTitle('Teacher Availability Setup');
  }
  if (mode === 'adminStudent') {
    return HtmlService.createHtmlOutputFromFile('AdminStudent')
      .setTitle('Student Course Booking');
  }
  if (mode === 'testmail') {
    return HtmlService.createHtmlOutputFromFile('MailTest')
      .setTitle('Mail Test');
  }
  if (mode === 'echotest') {
    const tpl = HtmlService.createTemplateFromFile('Echo');
    tpl.rawId = id||'';
    return tpl.evaluate().setTitle('Echo Test');
  }
  if (mode === 'teacher' && id) {
    const tpl = HtmlService.createTemplateFromFile('Teacher');
    tpl.meetingId = _sanitizeId(id);
    return tpl.evaluate().setTitle('Propose Times');
  }
  if (mode === 'teacherAvailability' && id) {
    const tpl = HtmlService.createTemplateFromFile('TeacherAvailability');
    tpl.availabilityId = _sanitizeId(id);
    return tpl.evaluate().setTitle('Set Your Availability');
  }
  if (mode === 'student' && id) {
    const tpl = HtmlService.createTemplateFromFile('Student');
    tpl.meetingId = _sanitizeId(id);
    return tpl.evaluate().setTitle('Select Your Final Time');
  }
  return HtmlService.createHtmlOutput('Invalid access');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// ======== ADMIN Helpers ========

function initializeSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);
  
  // Initialize TeacherAvailability sheet
  let aSh = ss.getSheetByName(AVAILABILITY_SHEET);
  const availabilityHeader = [
    'AvailabilityID', 'TeacherName', 'TeacherEmail', 'Month', 'AvailabilityData', 'Status'
  ];
  
  if (!aSh) {
    aSh = ss.insertSheet(AVAILABILITY_SHEET);
    aSh.appendRow(availabilityHeader);
  } else if (aSh.getLastRow() === 0 || aSh.getRange(1,1).getValue() !== 'AvailabilityID') {
    aSh.clear();
    aSh.appendRow(availabilityHeader);
  }
  
  // Initialize Meetings sheet with new structure
  let mSh = ss.getSheetByName(MEET_SHEET);
  const meetingHeader = [
    'MeetingID','Course', 'Location','StudentName','StudentEmail',
    'TeacherName','TeacherEmail',
    'Month','DateSelected',
    'Time1','Time2','Time3',
    'FinalTime','Status','MaxSlots'
  ];
  
  if (!mSh) {
    mSh = ss.insertSheet(MEET_SHEET);
    mSh.appendRow(meetingHeader);
  } else if (mSh.getLastRow() === 0 || mSh.getRange(1,1).getValue() !== 'MeetingID') {
    mSh.clear();
    mSh.appendRow(meetingHeader);
  } else {
    // Check if MaxSlots column exists, if not add it
    const headers = mSh.getRange(1, 1, 1, mSh.getLastColumn()).getValues()[0];
    if (!headers.includes('MaxSlots')) {
      mSh.getRange(1, headers.length + 1).setValue('MaxSlots');
    }
  }
  
  console.log('Sheets initialized successfully');
}

function getAdminData() {
  // Initialize sheets first
  initializeSheets();
  
  const ss = SpreadsheetApp.openById(SS_ID);

  // Students
  const sSh = ss.getSheetByName(STUDENT_SHEET);
  const students = sSh.getDataRange().getValues()
    .slice(1)
    .filter(r=>r[0]&&r[1])
    .map(r=>({name:r[0],email:r[1]}));

  // Teachers
  const tSh = ss.getSheetByName(TEACHERS_SHEET);
  const teachers = tSh.getDataRange().getValues()
    .slice(1)
    .filter(r=>r[0]&&r[1])
    .map(r=>({name:r[0],email:r[1]}));

  // Courses
  const cSh = ss.getSheetByName(COURSE_SHEET);
  const courses = cSh.getDataRange().getValues()
    .slice(1)
    .filter(r=>r[0])
    .map(r=>({name:r[0]}));

  // Teachers
  const lSh = ss.getSheetByName(LOCATION_SHEET);
  const locations = lSh.getDataRange().getValues()
    .slice(1)
    .filter(r=>r[0])
    .map(r=>({name:r[0]}));

  return {students,teachers, courses, locations};
}

function scheduleTeacherAvailability(data) {
  console.log('scheduleTeacherAvailability received data:', data);

  // Initialize sheets first
  initializeSheets();

  const ss = SpreadsheetApp.openById(SS_ID);
  const aSh = ss.getSheetByName(AVAILABILITY_SHEET);

  const availabilityId = Utilities.getUuid();
  const formattedMonth = formatMonth(data.month);

  aSh.appendRow([
    availabilityId, data.teacherName, data.teacherEmail, 
    formattedMonth, '', 'Pending'
  ]);

  const base = ScriptApp.getService().getUrl();
  const link = `${base}?mode=teacherAvailability&id=${encodeURIComponent(availabilityId)}`;

  MailApp.sendEmail({
    to: data.teacherEmail,
    subject: `Please set your availability for ${formattedMonth}`,
    htmlBody: `
      <p>Hi ${data.teacherName},</p>
      <p>Please set your availability for <b>${formattedMonth}</b>.</p>
      <p>You can choose "All Day Available", "Not Available", or "Specific Times" for each day.</p>
      <p><a href="${link}">Click here to set your availability</a></p>
    `
  });

  return availabilityId;
}

function scheduleStudentCourse(data) {
  console.log('scheduleStudentCourse received data:', data);

  // Initialize sheets first
  initializeSheets();

  const ss = SpreadsheetApp.openById(SS_ID);
  const mSh = ss.getSheetByName(MEET_SHEET);

  const meetingId = Utilities.getUuid();
  const formattedMonth = formatMonth(data.month);
  const monthJson = JSON.stringify([formattedMonth]);

  mSh.appendRow([
    meetingId, data.course, data.location,
    data.studentName, data.studentEmail,
    data.teacherName, data.teacherEmail,
    monthJson, '', '', '', '', '', 'PendingStudent', data.maxSlots
  ]);

  const base = ScriptApp.getService().getUrl();
  const link = `${base}?mode=student&id=${encodeURIComponent(meetingId)}`;

  MailApp.sendEmail({
    to: data.studentEmail,
    subject: `Course booking for ${data.course}`,
    htmlBody: `
      <p>Hi ${data.studentName},</p>
      <p>You have been assigned to <b>${data.course}</b> with ${data.teacherName} at <b>${data.location}</b>.</p>
      <p>Please select up to ${data.maxSlots} time slots in <b>${formattedMonth}</b>.</p>
      <p><a href="${link}">Click here to select your preferred times</a></p>
    `
  });

  return meetingId;
}

function scheduleMeeting(data) {
  console.log('scheduleMeeting received data:', data);
  console.log('Month to store:', data.month, 'type:', typeof data.month);  

  // Initialize sheets first
  initializeSheets();

  const ss = SpreadsheetApp.openById(SS_ID);
  const mSh = ss.getSheetByName(MEET_SHEET);

  const meetingId = Utilities.getUuid();
  const formattedMonth = formatMonth(data.month);
  const monthJson  = JSON.stringify([formattedMonth]);
  
  console.log('Storing monthJson:', monthJson);

  mSh.appendRow([
    meetingId, data.course, data.location,
    data.studentName, data.studentEmail,
    data.teacherName, data.teacherEmail,
    monthJson, '', '', '', '', '', 'PendingTeacher', 3 // Default max slots
  ]);

  const base = ScriptApp.getService().getUrl();
  const link = `${base}?mode=teacher&id=${encodeURIComponent(meetingId)}`;

  MailApp.sendEmail({
    to: data.teacherEmail,
    subject: `Please propose course days and times`,
    htmlBody: `
      <p>Hi ${data.teacherName},</p>
      <p>This is a course scheduler for <b>${data.course}</b> at <b>${data.location}</b>
      <p>Please pick one or more days in <b>${formattedMonth}</b> and propose up to three times for each day.</p>
      <p><a href="${link}">Click here to propose days and times</a></p>
    `
  });

  return meetingId;
}


// ======== MEETING LOOKUP ========
function getMeeting(rawId) {
  const id   = _sanitizeId(rawId);
  const ss   = SpreadsheetApp.openById(SS_ID);
  const rows = ss.getSheetByName(MEET_SHEET).getDataRange().getValues();

  rows.shift();  // drop header
  const row = rows.find(r=> r[0]===id);
  if (!row) {
    throw new Error('Meeting not found for id "'+id+'"');
  }

  // Debug the raw data
  console.log('Raw row[5] (DateOptions):', row[5], 'type:', typeof row[5]);
  

  const result = {
    meetingId:    row[0],
    course:       row[1],
    location:     row[2],
    studentName:  row[3],
    studentEmail: row[4],
    teacherName:  row[5],
    teacherEmail: row[6],
    dateOptions:  (JSON.parse(row[7]||'[]')[0] || ""), // Month - parse from JSON array
    dateSelected: JSON.parse(row[8]||'[]'), // All days as array
    day1Times:    JSON.parse(row[9]||'[]'), // Times for day 1
    day2Times:    JSON.parse(row[10]||'[]'), // Times for day 2
    day3Times:    JSON.parse(row[11]||'[]'), // Times for day 3
    finalTime:    row[12],
    status:       row[13],
    maxSlots:     row[14] || 3
  };
  console.log('Parsed dateOptions:', result.dateOptions);
  return result;
}

// ======== TEACHER AVAILABILITY LOOKUP ========
function getTeacherAvailability(rawId) {
  const id = _sanitizeId(rawId);
  
  // Initialize sheets first to ensure they exist
  initializeSheets();
  
  const ss = SpreadsheetApp.openById(SS_ID);
  const aSh = ss.getSheetByName(AVAILABILITY_SHEET);
  
  // Check if sheet has data
  if (aSh.getLastRow() === 0) {
    throw new Error('TeacherAvailability sheet is empty');
  }
  
  const rows = aSh.getDataRange().getValues();
  rows.shift();  // drop header
  
  const row = rows.find(r => r[0] === id);
  if (!row) {
    throw new Error('Teacher availability not found for id "' + id + '"');
  }

  const result = {
    availabilityId: row[0],
    teacherName:    row[1] || 'Unknown Teacher',
    teacherEmail:   row[2] || '',
    month:          row[3] || '',
    availabilityData: JSON.parse(row[4] || '{}'),
    status:         row[5] || 'Pending'
  };
  
  console.log('getTeacherAvailability returning:', result);
  return result;
}


// ======== TEACHER Submission ========
function submitTeacherOptions(data) {
  const id   = _sanitizeId(data.id);
  const ss   = SpreadsheetApp.openById(SS_ID);
  const sh   = ss.getSheetByName(MEET_SHEET);
  const vals = sh.getDataRange().getValues();

  for (let i=1; i<vals.length; i++) {
    if (vals[i][0]===id) {
      // Store all days in DateSelected column
      sh.getRange(i+1,9).setValue(JSON.stringify(data.days));
      
      // Store times for each day in Time1, Time2, Time3 columns
      sh.getRange(i+1,10).setValue(JSON.stringify(data.allTimes[0] || [])); // Day 1 times
      sh.getRange(i+1,11).setValue(JSON.stringify(data.allTimes[1] || [])); // Day 2 times  
      sh.getRange(i+1,12).setValue(JSON.stringify(data.allTimes[2] || [])); // Day 3 times
      sh.getRange(i+1,14).setValue('PendingStudent');

      const m     = getMeeting(id);
      const base  = ScriptApp.getService().getUrl();
      const slink = `${base}?mode=student&id=${encodeURIComponent(id)}`;
      MailApp.sendEmail({
        to: m.studentEmail,
        subject:`Please pick a course time`,
        htmlBody:`
          <p>Hi ${m.studentName},</p>
          <p>${m.teacherName} has proposed multiple days and times for your course.</p>
          <p><a href="${slink}">Choose your preferred day and time</a></p>
        `
      });
      return;
    }
  }
  throw new Error('Meeting not found for id "'+id+'"');
}


// ======== TEACHER AVAILABILITY SUBMISSION ========
function submitTeacherAvailability(data) {
  const id = _sanitizeId(data.id);
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(AVAILABILITY_SHEET);
  const vals = sh.getDataRange().getValues();
  
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === id) {
      // Store availability data and update status
      sh.getRange(i+1, 5).setValue(JSON.stringify(data.availability));
      sh.getRange(i+1, 6).setValue('Completed');
      
      // Get availability details for confirmation
      const availability = getTeacherAvailability(id);
      
      // Send confirmation email to teacher
      MailApp.sendEmail({
        to: availability.teacherEmail,
        subject: `Availability Confirmed - ${availability.month}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50; text-align: center;">✅ Availability Saved!</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="color: #34495e; margin-bottom: 15px;">Availability Details:</h3>
              <p><strong>Teacher:</strong> ${availability.teacherName}</p>
              <p><strong>Month:</strong> ${availability.month}</p>
              <p><strong>Days Set:</strong> ${Object.keys(data.availability).length} days</p>
              <p><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">Completed</span></p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #7f8c8d;">
              <p>Your availability has been successfully saved.</p>
              <p>Availability ID: <code>${id}</code></p>
            </div>
          </div>
        `
      });
      
      return;
    }
  }
  throw new Error('Teacher availability not found for id "' + id + '"');
}

/**
 * Student confirms the meeting and sets the final time.
 * Sets Status = 'fixed' and FinalTime to the selected time.
 * Sends email notification to the teacher.
 */
function submitStudentConfirmation(data) {
  const id = _sanitizeId(data.id);
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(MEET_SHEET);
  const vals = sh.getDataRange().getValues();
  
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === id) {
      // Column K (11) = FinalTime, Column L (12) = Status
      sh.getRange(i+1, 13).setValue(data.finalTime);
      sh.getRange(i+1, 14).setValue('fixed');
      
      // Get meeting details for email
      const meeting = getMeeting(id);
      
      // Send email to teacher
      MailApp.sendEmail({
        to: meeting.teacherEmail,
        cc: meeting.studentEmail,
        subject: `Course Confirmed - ${meeting.studentName}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50; text-align: center;">✅ Course Confirmed!</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="color: #34495e; margin-bottom: 15px;">Course Details:</h3>
              <p><strong>Course:</strong> ${meeting.course}</p>
              <p><strong>Location:</strong> ${meeting.location}</p>
              <p><strong>Student:</strong> ${meeting.studentName} (${meeting.studentEmail})</p>
              <p><strong>Teacher:</strong> ${meeting.teacherName}</p>
              <p><strong>Final Time:</strong> <span style="color: #27ae60; font-weight: bold;">${data.finalTime}</span></p>
              <p><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">Confirmed</span></p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #7f8c8d;">
              <p>This Course has been successfully scheduled.</p>
              <p>Course ID: <code>${id}</code></p>
            </div>
          </div>
        `
      });
      
      return;
    }
  }
  throw new Error('Course not found for id "' + id + '"');
}


// ======== TEACHER AVAILABILITY FOR MONTH ========
function getTeacherAvailabilityForMonth(teacherEmail, month) {
  // Initialize sheets first to ensure they exist
  initializeSheets();
  
  const ss = SpreadsheetApp.openById(SS_ID);
  const aSh = ss.getSheetByName(AVAILABILITY_SHEET);
  
  // Check if sheet has data
  if (aSh.getLastRow() === 0) {
    console.log('TeacherAvailability sheet is empty');
    return {};
  }
  
  const rows = aSh.getDataRange().getValues();
  rows.shift(); // drop header
  
  // Find availability records for this teacher and month
  const availabilityRecords = rows.filter(row => 
    row[2] === teacherEmail && row[3] === month && row[5] === 'Completed'
  );
  
  console.log(`Found ${availabilityRecords.length} availability records for ${teacherEmail} in ${month}`);
  
  if (availabilityRecords.length === 0) {
    return {};
  }
  
  // Combine all availability data for this teacher and month
  let combinedAvailability = {};
  availabilityRecords.forEach(record => {
    try {
      const availabilityData = JSON.parse(record[4] || '{}');
      combinedAvailability = { ...combinedAvailability, ...availabilityData };
    } catch (e) {
      console.error('Error parsing availability data:', e);
    }
  });
  
  console.log('Combined availability data:', combinedAvailability);
  return combinedAvailability;
}

// ======== STUDENT TIME SLOTS SUBMISSION ========
function submitStudentTimeSlots(data) {
  const id = _sanitizeId(data.id);
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(MEET_SHEET);
  const vals = sh.getDataRange().getValues();
  
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === id) {
      // Store selected time slots
      sh.getRange(i+1, 9).setValue(JSON.stringify(data.selectedTimes));
      sh.getRange(i+1, 14).setValue('PendingTeacherConfirmation');
      
      // Get meeting details for email
      const meeting = getMeeting(id);
      
      // Send email to teacher with student's preferences
      const timeSlotsText = data.selectedTimes.map(slot => 
        `${new Date(slot.date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })} at ${slot.time}`
      ).join('\n');
      
      MailApp.sendEmail({
        to: meeting.teacherEmail,
        subject: `Student Time Preferences - ${meeting.course}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50; text-align: center;">📅 Student Time Preferences</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="color: #34495e; margin-bottom: 15px;">Course Details:</h3>
              <p><strong>Course:</strong> ${meeting.course}</p>
              <p><strong>Location:</strong> ${meeting.location}</p>
              <p><strong>Student:</strong> ${meeting.studentName} (${meeting.studentEmail})</p>
              <p><strong>Selected Time Slots:</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${data.selectedTimes.map(slot => 
                  `<li>${new Date(slot.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })} at ${slot.time}</li>`
                ).join('')}
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #7f8c8d;">
              <p>Please review and confirm these time preferences.</p>
              <p>Course ID: <code>${id}</code></p>
            </div>
          </div>
        `
      });
      
      return;
    }
  }
  throw new Error('Course not found for id "' + id + '"');
}

// ======== MAIL TESTER ========
function testMail() {
  const you = 'your.address@example.com';
  MailApp.sendEmail(you,
    'Apps Script Mail Test',
    'If you receive this, MailApp.sendEmail is working fine.');
  return 'Test email sent to ' + you;
}
