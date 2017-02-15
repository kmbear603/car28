"use strict"

const express = require("express");
const app = express();

const fs = require("fs");

const car28 = require("./car28.js");

const PORT = process.env.PORT || 8080;

process.on('uncaughtException', err=>{
    console.warn(err);
});

Number.prototype.padLeft = function(base, chr){
    var len = (String(base || 10).length - String(this).length) + 1;
    return len > 0 ? new Array(len).join(chr || '0') + this : this;
}

// make sure it is https
app.use((req, res, next)=>{
    if (req.secure || req.headers["x-forwarded-proto"] === "https"){
        // OK, continue
        return next();
    }
    res.redirect('https://' + req.hostname + req.url);
});

app.get("/selectable-maker", (req, res)=>{
    car28.getSelectableMaker()
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/selectable-vehicle", (req, res)=>{
    car28.getSelectableType()
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/selectable-seat", (req, res)=>{
    car28.getSelectableSeat()
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/selectable-status", (req, res)=>{
    car28.getSelectableStatus()
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/selectable-transmission", (req, res)=>{
    car28.getSelectableTransmission()
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/search", (req, res)=>{
    car28.prepareSearch(req.query)
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/result/:search_id/:page?", (req, res)=>{
    const search_id = req.params.search_id;
    const page = parseInt(req.params.page) || 1;
    car28.getSearchResult(search_id, page)
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/detail/:vid", (req, res)=>{
    const vid = req.params.vid;
    car28.getDetail(vid)
        .then(result=>{
            res.send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/picture/:url", (req, res)=>{
    const url = req.params.url;
    car28.getPicture(url)
        .then(result=>{
            res.set("Content-Type", "image/jpeg").send(result);
        })
        .catch(err=>{
            res.status(500).send(err);
        });
});

app.get("/", (req, res)=>{
    const txt = fs.readFileSync("www/index.html", "utf-8");
    res.send(txt);
});

app.all("*", (req, res)=>{
    res.status(404).send("not found");
});

app.listen(PORT, ()=>{
    console.log("listening at " + PORT);
});

