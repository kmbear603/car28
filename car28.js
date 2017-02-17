"use strict"

const request = require("superagent");
const charset = require('superagent-charset');
charset(request);

const cheerio = require("cheerio");

const iconv = require('iconv-lite');

const ENCODING = "big5";
const OPTIONS = {};
const PAGE_SIZE = 20;
const SESSIONS = [];
const IMG_CACHE = [];
const IMG_CACHE_SIZE = 100;
var CURR_CAR28_REQUEST_COUNT = 0;

function serialize(req){
    return new Promise((resolve, reject)=>{
        const work = function(){
            if (CURR_CAR28_REQUEST_COUNT < 3){
                CURR_CAR28_REQUEST_COUNT++;
                req.then(ret=>{
                    CURR_CAR28_REQUEST_COUNT--;
                    resolve(ret);
                })
                .catch(err=>{
                    CURR_CAR28_REQUEST_COUNT--;
                    reject(err);
                });
            }
            else
                setTimeout(work, 1000);
        };
        work();
    });
}

function prepareOptions(){
    return new Promise((resolve, reject)=>{
        if (OPTIONS.inited)
            return resolve();
            
        if (OPTIONS.initing){
            const wait = function(){
                if (OPTIONS.inited)
                    return resolve();
                setTimeout(wait, 1000);
            };
            wait();
            return;
        }
        
        OPTIONS.initing = true;
        
        serialize(request.get("http://www.28car.com/index2.php")
            .timeout(10000))
            .then(res=>{
                const response_url = JSON.parse(JSON.stringify(res)).req.url;
                // response_url is in the format of http://xxxxxxxx.28car.com/
                
                serialize(request.post(response_url + "sell_lst.php")
                    .type("form")
                    .charset(ENCODING)
                    .timeout(10000))
                    .then(res=>{
                        const $ = cheerio.load(res.text);
                        
                        // type
                        OPTIONS.TYPE = [];
                        $("#h_f_ty").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();
                            OPTIONS.TYPE.push({
                                id: parseInt(id),
                                type: title
                            });
                        });

                        // maker
                        OPTIONS.MAKER = [];
                        $("#h_f_mk").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();
                            if (id == "1")
                                return true;
                            OPTIONS.MAKER.push({
                                id: parseInt(id),
                                maker: title
                            });
                        });
                        
                        // seat
                        OPTIONS.SEAT = [];
                        $("#h_f_se").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();
                            OPTIONS.SEAT.push({
                                id: parseInt(id),
                                //title: title,
                                seatCount: parseInt(title.replace(" 座", ""))
                            });
                        });
                        
                        // engine
                        OPTIONS.ENGINE = [];
                        $("#h_f_eg").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();
                            
                            const range = {};
                            if (title.indexOf("以下") != -1){   // 660 以下
                                const tokens = title.split(' ');
                                range.to = parseInt(tokens[0]);
                            }
                            else if (title.indexOf("以上") != -1){  // 4501 以上
                                const tokens = title.split(' ');
                                range.from = parseInt(tokens[0]);
                            }
                            else if (title.indexOf("-") != -1){ // 661-1500
                                const tokens = title.split('-');
                                range.from = parseInt(tokens[0]);
                                range.to = parseInt(tokens[1]);
                            }
                            else
                                return true;    // unknwon format
                            
                            if (range.from && range.to)
                                OPTIONS.ENGINE.push({
                                    id: parseInt(id),
                                    //title: title,
                                    from: range.from,
                                    to: range.to
                                });
                            else if (range.from)
                                OPTIONS.ENGINE.push({
                                    id: parseInt(id),
                                    //title: title,
                                    from: range.from
                                });
                            else if (range.to)
                                OPTIONS.ENGINE.push({
                                    id: parseInt(id),
                                    //title: title,
                                    to: range.to
                                });
                        });
                        
                        // transmission
                        OPTIONS.TRANSMISSION = [];
                        $("#h_f_tr").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();

                            OPTIONS.TRANSMISSION.push({
                                id: parseInt(id),
                                transmission: title
                            });
                        });
                        
                        // year
                        OPTIONS.YEAR = [];
                        $("#h_f_yr").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();
                            
                            const range = {};
                            if (title.indexOf("內") != -1)  // 2017內
                                range.start = parseInt(title.replace("內", ""));
                            else if (title.indexOf("前") != -1) // 2002前
                                range.end = parseInt(title.replace("前", "")) - 1;
                            else
                                range.start = range.end = parseInt(title);

                            if (range.start && range.end)
                                OPTIONS.YEAR.push({
                                    id: parseInt(id),
                                    //title: title,
                                    start: range.start,
                                    end: range.end
                                });
                            else if (range.start)
                                OPTIONS.YEAR.push({
                                    id: parseInt(id),
                                    //title: title,
                                    start: range.start
                                });
                            if (range.end)
                                OPTIONS.YEAR.push({
                                    id: parseInt(id),
                                    //title: title,
                                    end: range.end
                                });
                        });
                        
                        // price
                        OPTIONS.PRICE = [];
                        $("#h_f_pr").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();
                            
                            const range = {};
                            if (title.indexOf("以下") != -1)    // 1萬以下
                                range.max = parseInt(title.replace(/[^0-9]/g, "")) * 10000;
                            else if (title.indexOf("以上") != -1)    // 100萬以上
                                range.min = parseInt(title.replace(/[^0-9]/g, "")) * 10000;
                            else if (title.indexOf('-') != -1){ // 1萬-2萬
                                const tokens = title.split('-');
                                range.min = parseInt(tokens[0].replace(/[^0-9]/g, "")) * 10000;
                                range.max = parseInt(tokens[1].replace(/[^0-9]/g, "")) * 10000;
                            }
                            else
                                return true;    // unknown format
                            
                            if (range.min && range.max)
                                OPTIONS.PRICE.push({
                                    id: parseInt(id),
                                    //title: title,
                                    min: range.min,
                                    max: range.max
                                });
                            else if (range.min)
                                OPTIONS.PRICE.push({
                                    id: parseInt(id),
                                    //title: title,
                                    min: range.min
                                });
                            else if (range.max)
                                OPTIONS.PRICE.push({
                                    id: parseInt(id),
                                    //title: title,
                                    max: range.max
                                });
                        });
                        
                        // status
                        OPTIONS.STATUS = [];
                        $("#h_f_do").find("option").each((i, option)=>{
                            const id = $(option).val();
                            if (!id || id == "")
                                return true;
                            const title = $(option).text();
                            OPTIONS.STATUS.push({
                                id: parseInt(id),
                                status: title
                            });
                        });
                        
                        // sort
                        OPTIONS.SORT = [];
                        $("td.headnorm").each((i, td)=>{
                            const sort_id = parseInt($(td).attr("onclick").replace(/[^0-9]/g, ""));
                            const title = $(td).text().trim();
                            OPTIONS.SORT.push({
                                id: sort_id,
                                column: title
                            });
                        })

                        OPTIONS.initing = false;
                        OPTIONS.inited = true;
                        resolve();
                    })
                    .catch(err=>{
                        console.error(err);
                        reject(err);
                    });
            })
            .catch(err=>{
                console.error(err);
                reject(err);
            });
    });
}

function prepareSession(session){
    return new Promise((resolve, reject)=>{
        const agent = request.agent();
        
        serialize(agent.get("http://www.28car.com/index2.php"))
            .then(res=>{
                const response_url = JSON.parse(JSON.stringify(res)).req.url;
                // response_url is in the format of http://xxxxxxxx.28car.com/
                
                session.agent = agent;
                session.hostName = response_url;
                
                resolve();
            })
            .catch(err=>{
                reject(err);
            });
    });
}

Number.prototype.padLeft = function(base, chr){
    var len = (String(base || 10).length - String(this).length) + 1;
    return len > 0 ? new Array(len).join(chr || '0') + this : this;
}

function formatTime(t){
    return t.getFullYear() + "/" + (t.getMonth() + 1).padLeft(10) + "/" + t.getDate().padLeft(10)
        + " " + t.getHours().padLeft(10) + ":" + t.getMinutes().padLeft(10);
}

function trimLeadingTrailingSpaces(str){
    /*var start, end;
    for (start = 0; start < str.length && str.charAt(start) == " "; start++);
    for (end = str.length - 1; end >= 0 && str.charAt(end) == " "; end--);
    return str.substr(start, end - start + 1);*/
    return str.trimLeft().trimRight();
}

function translateOptionTo28CarOption(options){
    try {
        const find_id = function(collection, compare_function){
            const o = collection.find(compare_function);
            if (!o)
                return "";
            return o.id;
        }
        
        var type_id;
        if (options.type)
            type_id = find_id(OPTIONS.TYPE, t=>{ return t.type == options.type; });
        else
            type_id = "";

        var maker_id;
        if (options.maker)
            maker_id = find_id(OPTIONS.MAKER, t=>{ return t.maker == options.maker; });
        else
            maker_id = "";

        var seat_id;
        if (options.seatMin && options.seatMax && options.seatMin == options.seatMax)
            seat_id = find_id(OPTIONS.SEAT, t=>{ return t.seatCount == options.seatMin; });
        else
            seat_id = "";

        var engine_id;
        if (options.engineMin && options.engineMax)
            engine_id = find_id(OPTIONS.ENGINE, t=>{ return t.from && t.to && t.from <= options.engineMin && t.to >= options.engineMax; });
        else if (options.engineMin)
            engine_id = find_id(OPTIONS.ENGINE, t=>{ return t.from && !t.to && t.from <= options.engineMin; });
        else if (options.engineMax)
            engine_id = find_id(OPTIONS.ENGINE, t=>{ return !t.from && t.to && t.to >= options.engineMax; });
        else
            engine_id = "";

        var transmission_id;
        if (options.transmission)
            transmission_id = find_id(OPTIONS.TRANSMISSION, t=>{ return t.transmission == options.transmission; });
        else
            transmission_id = "";

        var year_id;
        if (options.yearMin && options.yearMax)
            year_id = find_id(OPTIONS.YEAR, y=>{ return y.start && y.end && y.start <= options.yearMin && y.end >= options.yearMax; });
        else if (options.yearMax)
            year_id = find_id(OPTIONS.YEAR, y=>{ return !y.start && y.end && y.end >= options.yearMax; });
        else if (options.yearMin)
            year_id = find_id(OPTIONS.YEAR, y=>{ return y.start && !y.end && y.start <= options.yearMin; });
        else
            year_id = "";

        var price_id;
        if (options.priceMin && options.priceMax)
            price_id = find_id(OPTIONS.PRICE, p=>{ return p.min && p.max && p.min <= options.priceMin && p.max >= options.priceMax; });
        else if (options.priceMin)
            price_id = find_id(OPTIONS.PRICE, p=>{ return p.min && !p.max && p.min <= options.priceMin; });
        else if (options.priceMax)
            price_id = find_id(OPTIONS.PRICE, p=>{ return !p.min && p.max && p.max >= options.priceMax; });
        else
            price_id = "";

        var status_id;
        if (options.status)
            status_id = find_id(OPTIONS.STATUS, s=>{ return s.status == options.status; });
        else
            status_id = "";
            
        var sort_id;
        if (options.sort)
            sort_id = find_id(OPTIONS.SORT, s=>{ return s.column == options.sort; });
        else
            sort_id = "";

        const search_str_raw = iconv.encode(options.remark ? options.remark : (options.model ? options.model : ""), ENCODING).toString("hex");
        var search_str = "";
        for (var i = 0; i < search_str_raw.length; i ++){   // insert %
            if (i % 2 == 0)
                search_str += "\%";
            search_str += search_str_raw.charAt(i).toUpperCase();
        }
        
        const ret = {
            h_srh: options.remark ? options.remark : (options.model ? options.model : ""),//search_str,
            h_srh_ty: options.remark ? 3 : 1,
            h_f_ty: type_id,
            h_f_mk: maker_id,
            h_f_se: seat_id,
            h_f_eg: engine_id,
            h_f_tr: transmission_id,
            h_f_yr: year_id,
            h_f_pr: price_id,
            h_f_do: status_id,
            h_sort: sort_id
        };

        //return ret;

        var form_data = "";
        for (var o in ret){
            const enc = o == "h_srh" ? search_str : encodeURIComponent(ret[o]);
            form_data += o + "=" + enc + "&";
        }
        
        return form_data.substr(0, form_data.length - 1);
    }
    catch (err){
        return null;
    }
}

function makeResult(session, page){
    if (!session.RESULTS)
        return { results: [], isLastPage: session.completed };
    
    const start = (page - 1) * PAGE_SIZE;
    if (start >= session.RESULTS.length)
        return { results: [], isLastPage: session.completed };
        
    return {
        results: session.RESULTS.slice(start, Math.min(start + PAGE_SIZE, session.RESULTS.length)),
        isLastPage: session.completed && page * PAGE_SIZE >= session.RESULTS.length
    }
}

function process(session, page){
    return new Promise((resolve, reject)=>{
        const after_wait = function(){
            const finish = function(ret){
                session.processing = false;
                return resolve(ret);
            };
            
            const finish_with_error = function(err){
                session.processing = false;
                return reject(err);
            };
            
            session.processing = true;
            
            prepareOptions()
                .then(()=>{
                    const car28_options = translateOptionTo28CarOption(session.options || {});
                    if (!car28_options)
                        return finish_with_error("incorrect options");
//console.log(car28_options);
                    const get_28car_page = function(car28_page){
                        return new Promise((resolve, reject)=>{
                            const agent = session.agent;
                            const hostname = session.hostName;
        
                            const get_28car_page_work = function(trial){
                                serialize(agent.post(hostname + "sell_lst.php")
                                    //.type("form")
                                    //.send(car28_options)
                                    //.send({ h_page: car28_page })
                                    .set("Content-Type", "application/x-www-form-urlencoded;charset=" + ENCODING)
                                    .send(car28_options + "&h_page=" + car28_page)
                                    .charset(ENCODING))
                                    .then(res=>{
                                        if (res.text.indexOf("window.location='msg_busy.php?") != -1){
                                            console.warn(new Date(), "search", "busy");
                                            if (trial == 10)
                                                return reject("too busy, giveup");
                                            return setTimeout(get_28car_page_work.bind(null, trial + 1), trial * 500);
                                        }
                                        
                                        const ret = [];
                    
                                        const $ = cheerio.load(res.text);
            
                                        var idx = 0;                                
                                        for (var idx = 0; ; idx++){
                                            const rw = $("#rw_" + idx);
                                            if (!rw || rw.length == 0)
                                                break;
                                                
                                            const obj = {};
                                            
                                            const title = $(rw).attr("title");
                                            obj.id = title.substr(title.lastIndexOf(' ') + 1);
                                            
                                            // get the vid
                                            $(rw).find("td").each((i, td)=>{
                                                const onclick = $(td).attr("onclick");
                                                // goDsp(10, 307893092, 'n')
                                                const tokens = onclick.split(',');
                                                obj.vid = trimLeadingTrailingSpaces(tokens[1]);
                                                return false;
                                            });
                                            
                                            $(rw).find("tr[height='36']").each((i, tr)=>{
                    
                                                $(tr).find("td").each((j, td)=>{
                                                    const txt = trimLeadingTrailingSpaces($(td).text());
                    
                                                    if (j == 0){ // name
                                                        if (i == 1){  // update time
                                                            // 14/0214:49
                                                            const hk_now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
                                                            var time = new Date(hk_now.getFullYear(), parseInt(txt.substr(3, 2)) - 1, parseInt(txt.substr(0, 2)), parseInt(txt.substr(5, 2)), parseInt(txt.substr(8, 2)), 0);
                                                            if (time.getTime() > hk_now.getTime())
                                                                time.setFullYear(hk_now.getFullYear() - 1);
                                                            obj.time = formatTime(time);
                                                            return false;
                                                        }
                                                
                                                        obj.maker = txt.split(' ')[0];
                                                        obj.model = txt.split(' ')[1];
                                                    }
                                                    else if (j == 1)    // seat
                                                        obj.seatCount = parseInt(txt.replace(/[^0-9]/g, ""));
                                                    else if (j == 2)    // engine
                                                        obj.engine = parseInt(txt.replace(/[^0-9]/g, ""));
                                                    else if (j == 3) // transmission
                                                        obj.transmission = txt;
                                                    else if (j == 4)    // year
                                                        obj.year = parseInt(txt);
                                                    else if (j == 5)    // price
                                                        obj.price = parseInt(txt.replace(/[^0-9]/g, ""));
                                                    else if (j == 9)    // sold
                                                        obj.sold = $(td).find("img").length > 0;
                                                });
                                            });

                                            if (session.options){
                                                const options = session.options;

                                                if ((options.model && obj.model.toLowerCase().indexOf(options.model.toLowerCase()) == -1)
                                                    || (options.yearMin && obj.year < options.yearMin)
                                                    || (options.yearMax && obj.year > options.yearMax)
                                                    || (options.engineMin && obj.engine < options.engineMin)
                                                    || (options.engineMax && obj.engine > options.engineMax)
                                                    || (options.priceMin && obj.price < options.priceMin)
                                                    || (options.priceMax && obj.price > options.priceMax)
                                                    || (options.seatMin && obj.seatCount < options.seatMin)
                                                    || (options.seatMax && obj.seatCount > options.seatMax))
                                                    continue;
                                            }
                                            
                                            ret.push(obj);
                                        }
                                        resolve({ completed: idx < 20, results: ret });
                                    })
                                    .catch(err=>{
                                        console.error(err);
                                        reject(err);
                                    });
                            }
                            
                            get_28car_page_work(1);
                        });
                    }
    
                    const after_prepare = function(){
                        const work = function(car28_page){
                            get_28car_page(car28_page)
                                .then(obj=>{
                                    const ret = obj.results;
                                    const completed = obj.completed;
                                    
                                    session.lastCar28Page = car28_page;
                                    session.completed = completed;
                                    
                                    if (!session.RESULTS)
                                        session.RESULTS = [];
                                        
                                    ret.forEach(o=>{
                                        if (session.RESULTS.findIndex(old_o=>{ return old_o.id == o.id }) != -1)
                                            return true;;
                                        session.RESULTS.push(o);
                                    });
                                    
                                    if (completed || session.RESULTS.length >= page * PAGE_SIZE)
                                        return finish(makeResult(session, page));
    
                                    work(car28_page + 1);
                                })
                                .catch(err=>{
                                    console.error(err);
                                    finish_with_error(err);
                                });
                        }
                        
                        work((session.lastCar28Page || 0) + 1);
                    };
    
    
                    if (!session.agent)        
                        prepareSession(session)
                            .then(()=>{
                                after_prepare();
                            })
                            .catch(err=>{
                                console.error(err);
                                finish_with_error(err);
                            });
                    else
                        after_prepare();
                })
                .catch(err=>{
                    finish_with_error(err);
                });
        };
        
        const wait = function(){
            if (session.completed || (session.RESULTS && session.RESULTS.length >= page * PAGE_SIZE))
                resolve(makeResult(session, page));
            else if (session.processing)
                setTimeout(wait, 1000);
            else
                after_wait();
        };
        wait();
    });
}

function getDetail(vid){
    return new Promise((resolve, reject)=>{
        const work = function(trial){
            serialize(request.get("http://www.28car.com/index2.php")
                .query({ tourl: "/sell_dsp.php?h_vid=" + vid })
                .charset(ENCODING))
                .then(res=>{
                    if (res.text.indexOf("window.location='msg_busy.php?") != -1){
                        console.warn(new Date(), "detail", "busy");
                        if (trial == 10)
                            return reject("too busy, giveup");
                        return setTimeout(work.bind(null, trial + 1), trial * 500);
                    }
                                        
                    const response_url = JSON.parse(JSON.stringify(res)).req.url;
                    // response_url is in the format of http://xxxxxxxx.28car.com/
                    
                    const $ = cheerio.load(res.text);
                    
                    const obj = {};
                    
                    $("tr[height='30']").each((i, tr)=>{
                        var field = "";
                        $(tr).children("td").each((j, td)=>{
                            const txt = trimLeadingTrailingSpaces($(td).text());
                            
                            if (j == 0){
                                if (txt == "編號")
                                    field = "id";
                                else if (txt == "車類")
                                    field = "type";
                                else if (txt == "車廠")
                                    field = "maker";
                                else if (txt == "型號")
                                    field = "model";
                                else if (txt == "座位")
                                    field = "seatCount";
                                else if (txt == "容積")
                                    field = "engine";
                                else if (txt == "傳動")
                                    field = "transmission";
                                else if (txt == "年份")
                                    field = "year";
                                else if (txt == "簡評")
                                    field = "remark";
                                else if (txt == "售價")
                                    field = "price";
                                else if (txt == "更新日期")
                                    field = "time";
                                else if (txt == "網址")
                                    field = "url";
                                else
                                    return false;
                            }
                            else if (j == 1){
                                var v = txt;
                                if (field == "maker")
                                    v = v.replace(" ", " ");
                                else if (field == "seatCount")
                                    v = parseInt(v.replace(/[^0-9]/g, ""));
                                else if (field == "engine")
                                    v = parseInt(v.replace(/[^0-9]/g, ""));
                                else if (field == "price")
                                    v = parseInt(v.split('[')[0].replace(/[^0-9]/g, ""));
                                else if (field == "year")
                                    v = parseInt(v);
                                else if (field == "transmission")
                                    v = v.split(' ')[0];
                                else if (field == "time")
                                    v = v.replace(/-/g, "/");
                                obj[field] = v;
                            }
                            else if (j == 2 && field == "id"){
                                // pictures
                                obj.picture = [];
                                $(td).find("img").each((k, img)=>{
                                    const ori = $(img).attr("src");
                                    if (ori.indexOf(".gif") == ori.length - 4)
                                        return true;
                                    
                                    const big_url = ori.replace("_m.jpg", "_b.jpg").replace("_s.jpg", "_b.jpg");
                                    const medium_url = ori.replace("_b.jpg", "_m.jpg").replace("_s.jpg", "_m.jpg");
                                    const small_url = ori.replace("_b.jpg", "_s.jpg").replace("_m.jpg", "_s.jpg");
                                    obj.picture.push({
                                        big: big_url,
                                        medium: medium_url,
                                        small: small_url
                                    });
                                });
                            }
                            else
                                return false;
                        });
                    });
    
                    resolve(obj);
                })
                .catch(err=>{
                    reject(err);
                });
        }
        
        work(1);
    });
}

function getPicture(url){
    return new Promise((resolve, reject)=>{
        const cache = IMG_CACHE.find(c=>{
            return c.url == url;
        });
        
        if (cache)
            return resolve(cache.data);

        serialize(request.get(url))
            .then(res=>{
                // clear old ones
                if (IMG_CACHE.length >= IMG_CACHE_SIZE)
                    IMG_CACHE.splice(0, IMG_CACHE.length - IMG_CACHE_SIZE + 1);

                IMG_CACHE.push({
                    url: url,
                    data: res.body
                });
                resolve(res.body);
            })
            .catch(err=>{
                reject(err);
            });
    });
}

function touchOptions(options){
    if (!options)
        return options;
        
    if (options.seatMin)
        options.seatMin = parseInt(options.seatMin);
    if (options.seatMax)
        options.seatMax = parseInt(options.seatMax);
        
    if (options.engineMin)
        options.engineMin = parseInt(options.engineMin);
    if (options.engineMax)
        options.engineMax = parseInt(options.engineMax);
        
    if (options.yearMin)
        options.yearMin = parseInt(options.yearMin);
    if (options.yearMax)
        options.yearMax = parseInt(options.yearMax);
        
    if (options.priceMin)
        options.priceMin = parseInt(options.priceMin);
    if (options.priceMax)
        options.priceMax = parseInt(options.priceMax);
        
    return options;
}

module.exports = {
    getSelectableMaker: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.MAKER);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSelectableType: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.TYPE);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSelectableSeat: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.SEAT);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSelectableEngine: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.ENGINE);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSelectableTransmission: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.TRANSMISSION);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSelectableYear: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.YEAR);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSelectablePrice: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.PRICE);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSelectableStatus: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.STATUS);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getSortableCriteria: function(){
        return new Promise((resolve, reject)=>{
            prepareOptions()
                .then(()=>{
                    resolve(OPTIONS.SORT);
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    prepareSearch: function(options){
        /* options
        {
            model,    // "jazz", "corolla", ...
            remark,    // "皮籠", "0首"...
            type, // "私家車", "客貨車", ..., exactly same as 28car's web papge option
            maker, // "極品", "愛快", "阿士頓馬田", ..., exactly same as 28car's web papge option
            seatMin, // 1, 2, 3, ...
            seatMax, // 1, 2, 3, ...
            engineMin,   // 1500, 2500, ..., in the unit of cc
            engineMax,   // 1500, 2500, ..., in the unit of cc
            transmission, // "AT", "MT"
            yearMin, // 2001, 2002, ...
            yearMax, // 2001, 2002, ...
            priceMin,    // 10000, 20000, ...
            priceMax,    // 10000, 20000, ...
            status,   // 已售, 未售
        }
        */
        return new Promise((resolve, reject)=>{
            // clear old sessions
            {
                const now = new Date().getTime();
                const remove_list = [];
                SESSIONS.forEach((s, i)=>{
                    if (s.time + 60 * 60 * 1000 < now)  // keep 1 hour
                        remove_list.push(i);
                });
                
                remove_list.forEach(i=>{
                    SESSIONS.splice(i, 1);
                });
            }
            
            var id;
            while (true){
                id = Math.floor(Math.random() * 999999);
                if (SESSIONS.findIndex(s=>{ return s.id == id; }) != -1)
                    continue;
                break;
            }
            
            const session = {
                id: id,
                options: touchOptions(options),
                time: new Date().getTime()
            };
            
            SESSIONS.push(session);
            
            // pre-fetch the first page
            process(session, 1)
                .then(()=>{
                    // nothing to do
                })
                .catch(()=>{
                    // nothing to do
                });
            
            resolve({
                id: id
            });
        });
    },

    getSearchResult: function(id, page){
        return new Promise((resolve, reject)=>{
            const session = SESSIONS.find(s=>{ return s.id == id; });
            if (!session)
                return reject(id + " not found");

            session.time = new Date().getTime();    // update the time
            if (session.processing)
                return resolve({
                    processing: true
                });
                        
            process(session, page)
                .then(res=>{
                    resolve(res);
                    
                    // pre-fetch the next page
                    if (!res.isLastPage)
                        process(session, page + 2).then(()=>{}).catch(()=>{});
                })
                .catch(err=>{
                    reject(err);
                });
        });
    },
    
    getDetail: getDetail,
    
    getPicture: getPicture,
};