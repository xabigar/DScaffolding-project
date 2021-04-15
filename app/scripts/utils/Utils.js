class Utils {
  static hasKeyValue (currentValue,index,arr){
    let conditions = this;
    for(let key in conditions){
      if((currentValue[key] == null) || (currentValue[key] != conditions[key])) return false;
    }
    return true;
  }

  static similarity (s1, s2){
    let editDistance = (a1, a2) => {
      a1 = a1.toLowerCase();
      a2 = a2.toLowerCase();
      let costs = new Array();
      for (let i = 0; i <= a1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= a2.length; j++) {
          if (i == 0)
            costs[j] = j;
          else {
            if (j > 0) {
              let newValue = costs[j - 1];
              if (a1.charAt(i - 1) != a2.charAt(j - 1))
                newValue = Math.min(Math.min(newValue, lastValue),
                  costs[j]) + 1;
              costs[j - 1] = lastValue;
              lastValue = newValue;
            }
          }
        }
        if (i > 0)
          costs[a2.length] = lastValue;
      }
      return costs[a2.length];
    }

    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
      longer = s2;
      shorter = s1;
    }
    let longerLength = longer.length;
    if (longerLength == 0) {
      return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
  }

  static getHexColor (r,g,b){
    var rHex = r.toString(16);
    var gHex = g.toString(16);
    var bHex = b.toString(16);
    if(rHex.length == 1) rHex = "0"+ rHex;
    if(gHex.length == 1) gHex = "0"+ gHex;
    if(bHex.length == 1) bHex = "0"+ bHex;
    return rHex+gHex+bHex;
  }

  static hexToRgb (hex){
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  static hexToCssRgba (hex,alpha){
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(result==null) return null;
    var r = parseInt(result[1], 16);
    var g = parseInt(result[2], 16);
    var b = parseInt(result[3], 16);
    return "rgba("+r+","+g+","+b+","+alpha+")"
  }

  static escapeHtml (text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  static backgroundColorToHex(b){
    var a = b.replace("rgb(","");
    a = a.replace(")","");
    var c = a.split(",");
    return this.rgbToHex(parseInt(c[0].trim()),parseInt(c[1].trim()),parseInt(c[2].trim()));
  }

  static isElement (o){
    return (
      typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
        o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
    );
  }

  static rgbToHex(r,g,b){
    var rHex = r.toString(16);
    var gHex = g.toString(16);
    var bHex = b.toString(16);
    if(rHex.length == 1) rHex = "0"+ rHex;
    if(gHex.length == 1) gHex = "0"+ gHex;
    if(bHex.length == 1) bHex = "0"+ bHex;
    return rHex+gHex+bHex;}
}

module.exports = Utils
