
let dragMgr = function(elem, start, move, end) {
    elem.on("mousedown", (e) => {
        start(e.pageX, e.pageY, e);
        let onmove = (e) => {
            //console.log(e.pageY);
            move(e.pageX, e.pageY, e);
        };
        let onend = (e) => {
            window.removeEventListener("mousemove",onmove);
            window.removeEventListener("mouseup",onend);
            end(e);
        };
        window.addEventListener("mousemove", onmove);
        window.addEventListener("mouseup", onend);
    });
    elem.on("touchstart", (e) => {
        start(e.touches[0].pageX, e.touches[0].pageY, e);
        let onmove = (e) => {
            move(e.touches[0].pageX, e.touches[0].pageY, e);
        };
        let onend = (e) => {
            window.removeEventListener("touchmove",onmove);
            window.removeEventListener("touchend",onend);
            end(e);
        };
        window.addEventListener("touchmove", onmove);
        window.addEventListener("touchend", onend);
    });
};



class DropArea extends ELEM{
    constructor(){
        super("div","class:droparea","Drop Files Here");
        console.log(this);
        let that = this;
        ['dragenter', 'dragover', 'dragleave', 'drop'].map(n=>{
            that.on(n,(e)=>{
                e.preventDefault();
            });
        });
        this.on("drop",(e)=>{
            console.log("something dropped");
            let items = e.dataTransfer.items;
            if(!items[0])return;
            let item = items[0];
            if(item.kind !== "file")return;
            let file = item.getAsFile();
            that.bus.emit("file",file);
        });
        this.bus = new Events();
    }
    onfile(cb){
        this.bus.on("file",cb);
    }
};

//schema includes vertices and edges
class Schema{
    constructor(){

    }

}

//canvas and nodes
class View extends ELEM{
    constructor(){
        super("div");
        this.imgcontainer
    }
}

//returns dataurl
let toTransparent = function(canvas){
    console.log(canvas);
    let ctx = canvas.getContext("2d");
    let w = canvas.width;
    let h = canvas.height;
    let imgdata = ctx.getImageData(0,0,w,h);
    let data = imgdata.data;
    /*for(let y = 0; y < h; y++){
        for(let x = 0; x < w; x++){
            let idx = 4*(y*w+x);
            if(data[idx] < 100){
                continue;
            }
            data[idx+3] = 0;//making it transparent
        }
    }*/
    return imgdata;
    //canvas.putImageData(data);
    //return canvas.toDataURL;
    //discard canvas
};

let toDataURL = function(imgdata){
    let canvas = document.createElement("canvas");
    canvas.width = imgdata.width;
    canvas.height = imgdata.height;
    let ctx = canvas.getContext("2d");
    ctx.putImageData(imgdata,0,0);
    return canvas.toDataURL();
};

let dataURLToCanvas = async function(durl){
    let img = document.createElement("img");
    img.src = durl;
    await new Promise((res,rej)=>{
        img.addEventListener("load",res);
    });
    let canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    let ctx = canvas.getContext("2d");
    ctx.drawImage(img,0,0);
    return canvas;
};

class Image extends ELEM{
    constructor(canvas){
        super("img","class:tracingimage");
        //make this into transparent image
        this.imgdata = toTransparent(canvas);
        this.e.src = toDataURL(this.imgdata);
        console.log(this.imgdata);
        this.generateThumbnail();
    }
    generateThumbnail(){
        let img = this.e;
        let tcanvas = document.createElement("canvas");
        tcanvas.width = 128;
        tcanvas.height = 128;
        let ctx = tcanvas.getContext("2d");
        ctx.drawImage(img,0,0,128,128);
        this.thumbnail = this.thumbnail || new ELEM("img");
        this.thumbnail.e.src = tcanvas.toDataURL();
    }
}


class Sketch{
    rotation = 0;//radians
    constructor(canvas){//directly out of libtiff
        let ctx = canvas.getContext("2d");
        let w = canvas.width;
        let h = canvas.height;
        this.width = w;
        this.height = h;
        let data = ctx.getImageData(0,0,w,h);
    }
}

let fileToCanvas = async function(file){
    let ext = file.name.split(".").pop();
    switch(ext){
        case "tif":
        case "tiff":
        let tiff = new Tiff({buffer: await file.arrayBuffer()});
        canvas = tiff.toCanvas();
        break;
        case "jpg":
        case "jpeg":
        case "png":
        //just draw it on canvas
        var fr = new FileReader();
        fr.readAsDataURL(file);
        await new Promise((res,rej)=>{
            fr.onload = ()=>{
                res();
            }
        });
        canvas = await dataURLToCanvas(fr.result);
        break;
        default:
        throw new Error("file format not supported");
        break;
    }
    return canvas;
};

class Thumb extends ELEM{
    constructor(img){
        super("div","class:thumb");
        let that = this;
        this.bus = new Events();
        this.add(img.thumbnail);
        //visibility
        this.visibility = true;
        this.ve = this.add("div","class:visiblecheck","👁");
        this.ve.on("click",(e)=>{
            e.stopPropagation();
            that.visibility = !that.visibility;
            let v = that.visibility;
            that.ve.setInner(that.visibility?"👁":"⍉");
            that.bus.emit(that.visibility?"show":"hide");
        });
        //edit selection
        this.selected = false;
        this.bc = this.add("div","class:bluecheck");
        this.bc.on("click",(e)=>{
            e.stopPropagation();
            if(!that.parent || !(that.parent instanceof ThumbnailToggle))return;
            let parent = that.parent;
            let selected = parent.selected;
            if(selected === that)return;//already selected
            that.bus.emit("select");
            that.parent.bus.emit("select",img);
            selected.bus.emit("unselect");
            selected.parent.bus.emit("unselect",img);
            parent.selected = that;
        });
        this.bus.on("select",()=>{
            bc.e.style.opacity = 1;
        });
        this.bus.on("unselect",()=>{
            bc.e.style.opacity = 0;
        });
    }
};

class ThumbnailToggle extends ELEM{
    constructor(){
        super("div","class:thumbtoggle");
        this.bus = new Events();
    }
    addImage(img){
        let thumb = new Thumb(img);
        this.add(thumb);
    }
};

class DisplayArea extends ELEM{
    constructor(){
        super("div","class:display-area",0,`
        position:relative;
        `);
        let that = this;
        dragMgr(this,
            (e)=>{//start

            },
            ()=>{//move

            },
            ()=>{//end

            }
        );
        this.on("mousedown",()=>{
        });
        //window.addEventListener("mouseup");
    }
}

class Widget extends ELEM{
    constructor(){
        super("div","class:thumbtoggle");
        let that = this;
        this.bus = new Events();

        //first deal with the thumbnail selector
        let tt = new ThumbnailToggle();
        this.add(tt);
        this.tt = tt;
        tt.bus.on("select",(img)=>{
            that.selected = img;
        });



        //after that's done, work on the display area
        let da = new DisplayArea();
        this.add(da);
        this.da = da;
        /*da.on("pan",()=>{

        });
        da.on("nodecreate",(e,ctx)=>{

        });
        da.on("nodemove",(e,ctx)=>{

        });*/

    }
    addImage(img){
        this.tt.addImage(img);
        this.da.add(img);
    }
}

let main = async function(){
    let body = new ELEM(document.body);
    let droparea = new DropArea();
    body.add(droparea);
    let widget = new Widget();
    body.add(widget);

    droparea.bus.on("file",async (file)=>{
        console.log(file.name);
        console.log(file);
        window.file = file;
        let ext = file.name.split(".").pop();
        //load the image, and make it transparent, generate thumbnail etc
        let img = new Image(await fileToCanvas(file));
        widget.addImage(img);


    });
};

main();
