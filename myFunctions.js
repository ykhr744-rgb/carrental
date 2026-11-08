var DISCOUNT_LIMIT_DAYS = 7;
var DISCOUNT_RATE = 0.10;
var MS_PER_DAY = 24 * 60 * 60 * 1000;


var OPERATORS = [
    { name: "Syriatel", prefixes: ["093", "098", "099"] },
    { name: "MTN",      prefixes: ["094", "095", "096"] }
];

var FIELD_IDS = ["fullName", "nationalId", "startDate", "endDate", "mobile", "email"];

function toWesternDigits(text) {
    var result = "";
    for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i);
        if (code >= 0x0660 && code <= 0x0669) {
            result += String(code - 0x0660);
        } else if (code >= 0x06F0 && code <= 0x06F9) {
            result += String(code - 0x06F0);
        } else {
            result += text.charAt(i);
        }
    }
    return result;
}

function formatNumber(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function escapeHtml(text) {
    return $("<div></div>").text(text).html();
}


//تحقق

function validateFullName(value) {
    if (value === "") {
        return "";
    }
    var arabicLettersOnly = /^[\u0621-\u063A\u0641-\u064A]+(\s+[\u0621-\u063A\u0641-\u064A]+)*$/;
    if (!arabicLettersOnly.test(value)) {
        return "الاسم يجب أن يتكون من أحرف هجائية عربية فقط (بدون أرقام أو رموز أو أحرف لاتينية).";
    }
    return "";
}

function validateNationalId(value) {
    if (value === "") {
        return "الرقم الوطني إلزامي.";
    }
    if (!/^\d{11}$/.test(value)) {
        return "الرقم الوطني يجب أن يتكون من 11 رقماً بالضبط.";
    }
    var province = parseInt(value.substring(0, 2), 10);
    if (province < 1 || province > 14) {
        return "أول خانتين من الرقم الوطني تمثلان المحافظة ويجب أن تكونا بين 01 و 14.";
    }
    return "";
}

function parseDate(text) {
    var parts = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
    if (parts === null) {
        return null;
    }
    var day = parseInt(parts[1], 10);
    var month = parseInt(parts[2], 10);
    var year = parseInt(parts[3], 10);
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
        return null;
    }
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return date;
}

function validateSingleDate(value, label) {
    if (value === "") {
        return label + " إلزامي.";
    }
    if (parseDate(value) === null) {
        return label + " غير صحيح، الصيغة المطلوبة dd-mm-yyyy وتاريخ موجود فعلاً.";
    }
    return "";
}

function validateDateOrder(startText, endText) {
    var start = parseDate(startText);
    var end = parseDate(endText);
    if (start !== null && end !== null && end.getTime() <= start.getTime()) {
        return "تاريخ نهاية التأجير يجب أن يكون لاحقاً لتاريخ البداية.";
    }
    return "";
}

function normalizeMobile(value) {
    var v = value.replace(/[\s\-\(\)]/g, "");
    if (v.indexOf("+963") === 0) {
        v = "0" + v.substring(4);
    } else if (v.indexOf("00963") === 0) {
        v = "0" + v.substring(5);
    } else if (v.indexOf("963") === 0 && v.length === 12) {
        v = "0" + v.substring(3);
    }
    return v;
}

function detectOperator(mobile) {
    var prefix = mobile.substring(0, 3);
    for (var i = 0; i < OPERATORS.length; i++) {
        for (var j = 0; j < OPERATORS[i].prefixes.length; j++) {
            if (OPERATORS[i].prefixes[j] === prefix) {
                return OPERATORS[i].name;
            }
        }
    }
    return "";
}

function validateMobile(value) {
    if (value === "") {
        return "";
    }
    var mobile = normalizeMobile(value);
    if (!/^09\d{8}$/.test(mobile)) {
        return "رقم الموبايل يجب أن يتكون من 10 أرقام ويبدأ بـ 09 (مثال: 0933123456).";
    }
    if (detectOperator(mobile) === "") {
        return "رقم الموبايل لا يطابق شبكتي Syriatel (093، 098، 099) أو MTN (094، 095، 096).";
    }
    return "";
}

function validateEmail(value) {
    if (value === "") {
        return "";
    }
    var emailPattern = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/;
    if (!emailPattern.test(value)) {
        return "صيغة البريد الإلكتروني غير صحيحة (مثال: name@example.com).";
    }
    return "";
}


//السيارات
function getSelectedCars() {
    var selected = [];
    $(".chk-select:checked").each(function () {
        var code = $(this).val();
        var row = $("#row-" + code);
        selected.push({
            code: code,
            model: row.find(".model-name").text(),
            price: parseInt(row.find(".price-val").text(), 10)
        });
    });
    return selected;
}

function renderSelectedCars() {
    var cars = getSelectedCars();
    var html = "<ul>";
    for (var i = 0; i < cars.length; i++) {
        html += "<li>" + escapeHtml(cars[i].code + " - " + cars[i].model) +
                " (" + formatNumber(cars[i].price) + " ل.س / يوم)</li>";
    }
    html += "</ul>";
    $("#selectedCars").html(html);
}

function calcRentalDays(startDate, endDate) {
    return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

function calcTotals(cars, days) {
    var total = 0;
    for (var i = 0; i < cars.length; i++) {
        total += cars[i].price * days;
    }
    var discount = 0;
    if (days > DISCOUNT_LIMIT_DAYS) {
        discount = Math.round(total * DISCOUNT_RATE);
    }
    return { total: total, discount: discount, final: total - discount };
}

function showResult(cars, startText, endText, days, fullName) {
    var totals = calcTotals(cars, days);
    var html = "";

    if (fullName !== "") {
        html += "<p><strong>مقدم الطلب:</strong> " + escapeHtml(fullName) + "</p>";
    }
    html += "<p><strong>فترة التأجير:</strong> من " + startText + " إلى " + endText + "</p>";

    html += "<table><thead><tr><th scope=\"col\">السيارة</th><th scope=\"col\">السعر اليومي</th>" +
            "<th scope=\"col\">عدد الأيام</th><th scope=\"col\">المبلغ</th></tr></thead><tbody>";
    for (var i = 0; i < cars.length; i++) {
        html += "<tr><td>" + escapeHtml(cars[i].model) + "</td>" +
                "<td>" + formatNumber(cars[i].price) + " ل.س</td>" +
                "<td>" + days + "</td>" +
                "<td>" + formatNumber(cars[i].price * days) + " ل.س</td></tr>";
    }
    html += "<tr class=\"total-row\"><td colspan=\"3\">المجموع قبل الخصم</td><td>" + formatNumber(totals.total) + " ل.س</td></tr>";
    html += "<tr><td colspan=\"3\">الخصم" + (totals.discount > 0 ? " (10%)" : "") + "</td><td>" + formatNumber(totals.discount) + " ل.س</td></tr>";
    html += "<tr class=\"final-row\"><td colspan=\"3\">المبلغ النهائي</td><td>" + formatNumber(totals.final) + " ل.س</td></tr>";
    html += "</tbody></table>";

    if (totals.discount > 0) {
        html += "<p class=\"discount-yes\">تم تطبيق خصم 10% لأن مدة التأجير (" + days + " أيام) تجاوزت " + DISCOUNT_LIMIT_DAYS + " أيام.</p>";
    } else {
        html += "<p>لا يوجد خصم: مدة التأجير لم تتجاوز " + DISCOUNT_LIMIT_DAYS + " أيام.</p>";
    }

    $("#resultContent").html(html);
    $("#resultPanel").stop(true, true).slideDown(350, function () {
        $("html, body").animate({ scrollTop: $("#resultPanel").offset().top - 20 }, 300);
    });
}

function closeResult() {
    $("#resultPanel").slideUp(250);
}

function validateFieldLive(id) {
    var v = toWesternDigits($.trim($("#" + id).val()));
    if (id === "fullName")   { return validateFullName($.trim($("#fullName").val())); }
    if (id === "nationalId") { return validateNationalId(v); }
    if (id === "startDate")  { return validateSingleDate(v, "تاريخ بداية التأجير"); }
    if (id === "endDate") {
        var m = validateSingleDate(v, "تاريخ نهاية التأجير");
        if (m === "" && $("#startDate").val() !== "" && parseDate(toWesternDigits($.trim($("#startDate").val()))) !== null) {
            m = validateDateOrder(toWesternDigits($.trim($("#startDate").val())), v);
        }
        return m;
    }
    if (id === "mobile")     { return validateMobile(v); }
    if (id === "email")      { return validateEmail($.trim($("#email").val())); }
    return "";
}


//نموذج

function clearErrors() {
    for (var i = 0; i < FIELD_IDS.length; i++) {
        $("#err-" + FIELD_IDS[i]).text("");
        $("#" + FIELD_IDS[i]).removeClass("invalid valid");
    }
}

function setError(fieldId, message) {
    $("#err-" + fieldId).text(message);
    $("#" + fieldId).addClass("invalid");
}

function handleSubmit() {
    clearErrors();

    var fullName   = $.trim($("#fullName").val());
    var nationalId = toWesternDigits($.trim($("#nationalId").val()));
    var startText  = toWesternDigits($.trim($("#startDate").val()));
    var endText    = toWesternDigits($.trim($("#endDate").val()));
    var mobile     = toWesternDigits($.trim($("#mobile").val()));
    var email      = $.trim($("#email").val());

    var valid = true;
    var msg;

    msg = validateFullName(fullName);
    if (msg !== "") { setError("fullName", msg); valid = false; }

    msg = validateNationalId(nationalId);
    if (msg !== "") { setError("nationalId", msg); valid = false; }

    msg = validateSingleDate(startText, "تاريخ بداية التأجير");
    if (msg !== "") { setError("startDate", msg); valid = false; }

    msg = validateSingleDate(endText, "تاريخ نهاية التأجير");
    if (msg !== "") { setError("endDate", msg); valid = false; }

    if ($("#err-startDate").text() === "" && $("#err-endDate").text() === "") {
        msg = validateDateOrder(startText, endText);
        if (msg !== "") { setError("endDate", msg); valid = false; }
    }

    msg = validateMobile(mobile);
    if (msg !== "") { setError("mobile", msg); valid = false; }

    msg = validateEmail(email);
    if (msg !== "") { setError("email", msg); valid = false; }

    var cars = getSelectedCars();
    if (cars.length === 0) {
        $("#selectMsg").text("الرجاء اختيار سيارة واحدة على الأقل.");
        valid = false;
    }

    if (!valid) {
        if ($(".invalid").length > 0) {
            $("html, body").animate({ scrollTop: $(".invalid").first().offset().top - 120 }, 300);
        }
        return false;
    }

    var days = calcRentalDays(parseDate(startText), parseDate(endText));
    showResult(cars, startText, endText, days, fullName);
    return false;
}


$(document).ready(function () {

    $("#content").hide().fadeIn(400);

    $("#exitLink").on("click", function (e) {
        e.preventDefault();
        if (window.confirm("هل تريد الخروج من الموقع؟")) {
            window.close();
            window.location.href = "about:blank"
        }
    });

    if ($(".branch-title").length > 0) {
        $(".branch-body").hide();
        $(".branch-body").first().show();
        $(".branch-title").on("click", function () {
            $(this).next(".branch-body").slideToggle(250);
        });
    }

    if ($("#carsTable").length > 0) {

        $(".chk-show").on("change", function () {
            var details = $("#details-" + $(this).val());
            if ($(this).is(":checked")) {
                details.stop(true, true).fadeIn(250);
            } else {
                details.stop(true, true).fadeOut(200);
            }
        });

        $(".chk-select").on("change", function () {
            $("#row-" + $(this).val()).toggleClass("selected-row", $(this).is(":checked"));
            $("#selectMsg").text("");
            if ($("#bookingForm").is(":visible")) {
                if (getSelectedCars().length === 0) {
                    $("#bookingForm").slideUp(250);
                } else {
                    renderSelectedCars();
                }
            }
        });

        $("#btnContinue").on("click", function () {
            if (getSelectedCars().length === 0) {
                $("#selectMsg").text("الرجاء اختيار سيارة واحدة على الأقل قبل المتابعة.");
                return;
            }
            $("#selectMsg").text("");
            renderSelectedCars();
            $("#bookingForm").slideDown(350, function () {
                $("html, body").animate({ scrollTop: $("#bookingForm").offset().top - 20 }, 300);
            });
        });

        $("#bookingForm").on("submit", function (e) {
            e.preventDefault();
            handleSubmit();
        });

        $("#bookingForm").on("reset", function () {
            clearErrors();
        });

        $("#btnCloseResult").on("click", closeResult);

        $("#bookingForm input[type='text']").on("blur", function () {
            var id = $(this).attr("id");
            if ($.trim($(this).val()) === "" && id !== "nationalId" && id !== "startDate" && id !== "endDate") {
                $(this).removeClass("valid invalid");
                $("#err-" + id).text("");
                return;
            }
            var msg = validateFieldLive(id);
            $("#err-" + id).text(msg);
            $(this).toggleClass("invalid", msg !== "").toggleClass("valid", msg === "");
        });

        $("#bookingForm input[type='text']").on("input", function () {
            var id = $(this).attr("id");
            $(this).removeClass("invalid valid");
            $("#err-" + id).text("");
        });
    }
});
