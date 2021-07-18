const fs = require('fs')
const https = require('https');

async function allTransaction() {
  const response = await doRequest("https://www.housingauthority.gov.hk/json/transaction-record/index.json")
  const { districts } = response
  const array = []
  districts.forEach((v) => {
    v.estates["hos-court"] && v.estates["hos-court"].forEach((h) => {
      array.push({
        districtId: v.districtId.replace(/\s+/g, ''),
        name: v.name["zh-Hant"].replace(/\s+/g, ''),
        estate: h.estate["zh-Hant"].replace(/\s+/g, ''),
        aplySysId: h.aplySysId.replace(/\s+/g, '')
      })
    })
  })
  doWriteFile("infoList", array)
  //doWriteFile("list", array.map(v => `${v.name}-${v.estate}`))
  await Promise.all(array.map(v => {
    return transactionByHOS(v)
  }))
}

async function getFullYearTransaction(year) {
  let trans = {}
  let temp = []
  await Promise.all([...Array(12).keys()].map(x => ++x).map(async x => {
    const month = ("0" + x).slice(-2)
    try {
      const result = await doRequest(`https://www.housingauthority.gov.hk/json/transaction-record/byMonth/${year}/${month}.json`)
      trans[month] = []
      result.forEach(({ district, name }) => {
        district && district.forEach((v) => {
          v.location && v.location.forEach((i) => {
            i.location && i.location.forEach(j => {
              const data = {
                saleableFloorArea: j.saleableFloorArea.split("/")[0].split(" ").join("").split(",").join(""),
                transPrice: j.transPrice.split("/")[0].split(" ").join("").split(",").join(""),
                pricePerArea: j.pricePerArea.split("/")[0].split(" ").join("").split(",").join(""),
                discountRate: j.discountRate,
                floor: j.floor,
                name: j.name["zh-Hant"],
                district: i.name["zh-Hant"],
                area: name["zh-Hant"],
                date: `${month}/${year}`
              }
              trans[month].push(data)
              temp.push(data)
            })
          })
        })
      })
    }
    catch (e) {
      console.log(e)
    }
  }))
  const map = new Map()
  temp.forEach(x => {
    if (map.has(x.name)) {
      map.set(x.name, { area: x.area, district: x.district, count: map.get(x.name).count + 1 })
    }
    else {
      map.set(x.name, { area: x.area, district: x.district, count: 1 })
    }

  })
  console.log([...map].sort((a, b) => b[1].count - a[1].count).map(x => {
    return { ...x[1], name: x[0] }
  }))
  doWriteFile(`byYear/${year}`, trans)
  doWriteFile(`byYear/${year}-ranking`, [...map].sort((a, b) => b[1].count - a[1].count).map(x => {
    return { ...x[1], name: x[0] }
  })) //Object.fromEntries(map))
  return trans
}

async function recentTransaction() {
  const dateObj = new Date();
  const year = dateObj.getUTCFullYear();
  for (let i = 2002; i <= year; i++)
    getFullYearTransaction(i)
}

async function availableHOS() {
  const hos = await doRequest("https://www.housingauthority.gov.hk/json/avail-hos/available_hos_index.json")
  const courts = await doRequest("https://www.housingauthority.gov.hk/json/avail-hos/detail/available_hos_courts_districtKey.json")
  hos.district = hos.district.map(({ tcDistName, tcRgnName, distkey }) => {
    return { tcDistName, tcRgnName, distkey }
  })

  console.log(hos.district)
  let available_courts = []
  for (const k in courts) {
    available_courts.push(...courts[k].map(x => ({ ...x, tcDistName: hos.district.find(x => x.distkey === k).tcDistName })))
  }

  const temp = {}
  hos.district = hos.district.map((v) => {
    let list = courts[v.distkey].map(v => v.tcName)
    list = [...new Set(list)]
    return { ...v, list }
  })
  hos.district.forEach((v) => {
    if (temp[v.tcRgnName]) {
      temp[v.tcRgnName].push(v)
    }
    else {
      temp[v.tcRgnName] = [v]
    }
  })

  available_courts = available_courts.map(x => {
    return {
      tcDistName: x.tcDistName,
      sqftFloorArea: x.sqftFloorArea,
      approRngDiscount: x.approRngDiscount,
      noOFBlocks: x.noOFBlocks.split(",").join(""),
      tcName: x.tcName,
      dateOfIntake: x.dateOfIntake,
      noOFFlats: x.noOFFlats.split(",").join(""),
      tcSubDistrictName: x.tcSubDistrictName,
    }
  })
  //console.log(available_courts)
  doWriteFile("available_courts", available_courts)
  doWriteFile("list", temp)
}

function transactionByHOS(v) {
  return doRequest(`https://www.housingauthority.gov.hk/json/transaction-record/byEstate/${v.districtId}/${v.aplySysId}.json`).then((response) => {
    console.log(`${v.name}-${v.estate}`)
    const { result } = response
    doWriteFile(`data/${v.estate}`, response)
    result.sort(function(a, b) {
      return parseInt(a.year, 10) - parseInt(b.year, 10);
    });
    var b = [];
    var c = {};
    var h = [],
      l = [],
      m = [];
    for (var i = 0; i < 22; i++) {
      h.push({ x: 0, y: (2000 + i).toString() });
      l.push({ x: 0, y: (2000 + i).toString() });
      m.push({ x: 0, y: (2000 + i).toString() });
    }
    result.forEach((v, i) => {
      const { data, year } = v;
      let temp = [];
      data.forEach((v) => {
        temp.push(parseInt(v.month, 10));
        switch (v.floor) {
          case "H":
            h.push({
              x: parseInt(v.pricePerArea.split("/")[0].split(",").join(""), 10),
              y: year
            });
            break;
          case "L":
            l.push({
              x: parseInt(v.pricePerArea.split("/")[0].split(",").join(""), 10),
              y: year
            });
            break;
          case "M":
            m.push({
              x: parseInt(v.pricePerArea.split("/")[0].split(",").join(""), 10),
              y: year
            });
            break;
          default:
        }
      });
      temp.forEach((v) => {
        let found = b.find((a) => a.x === v && a.y === year);
        if (found) {
          found.count++;
        }
        else {
          b.push({ x: v, y: year, count: 1 });
        }
      });
    });
    c = { h, l, m };
    for (const property in c) {
      c[property] = c[property]
        .reduce((acc, d) => {
          let found = acc.find((a) => a.y === d.y);
          if (found) {
            found.x += d.x;
            found.count++;
          }
          else {
            if (d.x !== 0) acc.push({ x: d.x, y: d.y, count: 1 });
            else acc.push({ x: d.x, y: d.y, count: 0 });
          }
          return acc;
        }, [])
        .map((e) => ({ x: e.y, y: e.count === 0 ? 0 : e.x / e.count }));
    }


  })
}

function doWriteFile(fileName, data) {
  fs.writeFileSync(`./${fileName}.json`, JSON.stringify(data), err => {
    if (err) {
      console.error(err)
      return
    }
  })
}

function doRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.get(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseBody));
        }
        catch (e) {
          reject(e)
        }

      });
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    })
  });
}

const start = async() => {
  allTransaction()
  availableHOS()
  recentTransaction()
}
start()
