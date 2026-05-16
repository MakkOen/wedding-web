function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Ucast");
  if (!sheet) {
    return _jsonResponse({ result: "error", error: "Sheet not found" });
  }
  var rows = sheet.getDataRange().getValues();
  var attendees = rows.slice(1).map(function(row) {
    return { jmeno: row[0], pocet_osob: row[1], pocet_deti: row[2], timestamp: row[3] };
  });
  return _jsonResponse({ result: "success", attendees: attendees });
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Ucast");
    if (!sheet) {
      return _jsonResponse({ result: "error", error: "Sheet not found" });
    }
    var data = JSON.parse(e.postData.contents);
    var jmeno = (data.jmeno || "").toString().trim();
    var pocetOsob = parseInt(data.pocet_osob, 10);
    var pocetDeti = parseInt(data.pocet_deti, 10);

    if (!jmeno || jmeno.length < 2 || jmeno.length > 200) {
      return _jsonResponse({ result: "error", error: "Neplatné jméno" });
    }
    if (isNaN(pocetOsob) || pocetOsob < 0 || pocetOsob > 50) {
      return _jsonResponse({ result: "error", error: "Neplatný počet osob" });
    }
    if (isNaN(pocetDeti) || pocetDeti < 0 || pocetDeti > 50) {
      return _jsonResponse({ result: "error", error: "Neplatný počet dětí" });
    }
    if (data.website) {
      return _jsonResponse({ result: "error", error: "Bot" });
    }

    sheet.appendRow([jmeno, pocetOsob, pocetDeti, new Date()]);
    return _jsonResponse({ result: "success" });
  } catch (err) {
    return _jsonResponse({ result: "error", error: err.toString() });
  }
}

function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
