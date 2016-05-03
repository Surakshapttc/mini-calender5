/* jshint -W097 */// jshint strict:false
/*jslint node: true */

"use strict";
var utils    = require(__dirname + '/lib/utils'); // Get common adapter utils
var holidays = require(__dirname + '/admin/holidays').holidays; // Get common adapter utils

var lang = 'de';

var adapter = utils.adapter({
    name:           'feiertage',
    useFormatDate:  true
});

adapter.on('ready', function () {
    adapter.getForeignObject('system.config', function (err, data) {
        if (data && data.common) {
            lang  = data.common.language;
        }

        adapter.log.debug('adapter feiertage initializing objects');
        checkHolidays();
        adapter.log.info('adapter feiertage objects written');

        setTimeout(function () {
            adapter.log.info('force terminating after 1 minute');
            adapter.stop();
        }, 60000);

    });
});
 
function readSettings() {
    for (var h in holidays) {
        holidays[h].enabled = adapter.config['enable_' + h];
    }
} 

// Get the name of holiday for the day of the year
function getHoliday(day, isLeap, easter, _lang) {
    _lang = _lang || lang;

    for (var h in holidays) {
        if (holidays[h].enabled) {
            if (holidays[h].offset && (holidays[h].offset + (holidays[h].leap ? isLeap : 0)) == day) {
                return holidays[h][_lang] + (holidays[h]['comment_' + _lang] ? ' ' + holidays[h]['comment_' + _lang] : '');
            }
            if (holidays[h].easterOffset && (easter + holidays[h].easterOffset) == day) {
                return holidays[h][_lang] + (holidays[h]['comment_' + _lang] ? ' ' + holidays[h]['comment_' + _lang] : '');
            }
        }
    }
    return '';
} 

function getDateFromYearsDay(day, isLeap) {
    var dayMs     = (day - isLeap) * 24 * 60 * 60 * 1000; // Day of the year in ms from 01.01 00:00:00
    var now       = new Date();
    var year      = now.getFullYear();
    var newYear   = new Date(year, 0, 1, 0, 0, 0, 0);     // This year 01.01 00:00:00
    var newYearMs = newYear.getTime();
    var date      = new Date();
    
    date.setTime(newYearMs + dayMs);                      // Add to current New year the ms
    return date;    
}

// check the holidays
function checkHolidays() {
    readSettings();
    var now    = new Date();
    var year   = now.getFullYear();
    var isLeap = (year % 4 === 0) ? 1 : 0;

    // THe modified Gauss-Formula to calculate catholic eastern, valid till 2048
    var A = 120 + (19 * (year % 19) + 24) % 30;
    var B = (A + parseInt(5 * year / 4)) % 7;
    // Easter sunday: day of the year
    var easter = A - B - 33 + isLeap;

    // Day of the year
    var todayStart = new Date(now.setHours(0, 0, 0, 0));
    var newYear    = new Date(year, 0, 1);
    var diffDays   = (todayStart - newYear) / (24 * 60 * 60 * 1000) + 1;
    var day        = Math.ceil(diffDays);

    // today
    var hd = getHoliday(day, isLeap, easter);
    adapter.setState('heute.Name',    {ack: true, val: getHoliday(day, isLeap, easter, 'de')});
    adapter.setState('heute.boolean', {ack: true, val: !!hd});
    adapter.setState('today.name',    {ack: true, val: hd});
    adapter.setState('today.boolean', {ack: true, val: !!hd});

    // tomorrow
    day = day + 1;
    if (day > 365 + isLeap) day = 1;
    hd = getHoliday(day, easter);
    adapter.setState('morgen.Name',      {ack: true, val: getHoliday(day, isLeap, easter, 'de')});
    adapter.setState('morgen.boolean',   {ack: true, val: !!hd});
    adapter.setState('tomorrow.name',    {ack: true, val: hd});
    adapter.setState('tomorrow.boolean', {ack: true, val: !!hd});

    // the day after tomorrow
    day = day + 1;
    if (day > 365 + isLeap) day = 1;
    hd = getHoliday(day, isLeap, easter);
    adapter.setState('uebermorgen.Name',      {ack: true, val: getHoliday(day, isLeap, easter, 'de')});
    adapter.setState('uebermorgen.boolean',   {ack: true, val: !!hd});
    adapter.setState('aftertomorrow.name',    {ack: true, val: hd});
    adapter.setState('aftertomorrow.boolean', {ack: true, val: !!hd});

    // next holiday
    var duration = 0;
    day = day - 1; // shift back to "tomorrow", because tomorrow is the next day
    do {
        day = day + 1;
        if (day > 365 + isLeap) day = 1;
        duration = duration + 1;
        hd = getHoliday(day, isLeap, easter);

        if (hd) {
            var date = getDateFromYearsDay(day, isLeap);
            adapter.setState('naechster.Name', {ack: true, val: getHoliday(day, isLeap, easter, 'de')});
            adapter.setState('next.name',      {ack: true, val: hd});

            var nextHoliday = adapter.formatDate(date);
            adapter.log.info('Next holiday: ' + hd + ' is in ' + duration + ' days on ' + nextHoliday);

            adapter.setState('naechster.Datum', nextHoliday, true);
            adapter.setState('next.date',       nextHoliday, true);

            adapter.setState('naechster.Dauer', duration, true);
            adapter.setState('next.duration',   duration, true, function () {
                adapter.stop();
            });
            break;
        }
    } while (!hd);
}
