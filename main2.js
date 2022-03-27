
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




let waitImageLoad = function(img){
    return new Promise((res,rej)=>{
        res();
    });
};


class Image extends ELEM{
    constructor(){
        super("div","class:tracingimage");
        this.opaque = this.add("img","class:opaque");
        this.transparent = this.add("img","class:transparent");
        this.thumbnail = new ELEM("img");
    }
    async load(file){
        let ext = file.name.split(".").pop();
        switch(ext){
            case "tif":
            case "tiff":
            await this.loadTiff(file);
            break;
            case "jpg":
            case "jpeg":
            case "png":
            await this.loadGeneric(file);
            break;
            default:
            throw new Error("file format not supported");
            break;
        }
    }
    //mutates the image data
    async loadTransparent(imgdata){
        let canvas = document.createElement("canvas");
        let w = imgdata.width;
        let h = imgdata.height;
        canvas.width = w;
        canvas.height = h;
        let ctx = canvas.getContext("2d");
        let data = imgdata.data;
        for(let y = 0; y < h; y++){
            for(let x = 0; x < w; x++){
                let idx = 4*(y*w+x);
                if(data[idx] < 100){
                    continue;
                }
                data[idx+3] = 0;//making it transparent
            }
        }
        ctx.putImageData(imgdata,0,0);
        let img = this.transparent.e;
        img.src = canvas.toDataURL();
        await waitImageLoad(img);
    }
    async loadOpaque(dataurl){
        let img = this.opaque.e;
        img.src = dataurl;
        await waitImageLoad(img);
    }
    async loadTiff(file){
        let that = this;
        let tiff = new Tiff({buffer: await file.arrayBuffer()});
        let canvas = tiff.toCanvas();
        let ctx = canvas.getContext("2d");
        let imgdata = ctx.getImageData(0,0,canvas.width,canvas.height);
        this.loadTransparent(imgdata);
        this.loadOpaque(canvas.toDataURL()).then(()=>{
            that.loadThumbnail();
        });

    }
    async loadGeneric(file){
        let that = this;
        //just draw it on canvas
        var fr = new FileReader();
        fr.readAsDataURL(file);
        await new Promise((res,rej)=>{
            fr.onload = ()=>{
                res();
            }
        });
        let durl = fr.result;
        this.loadOpaque(durl).then(()=>{
            that.loadThumbnail();
            let img = that.opaque.e;
            let canvas = document.createElement("canvas");
            let w = img.width;
            let h = img.height;
            canvas.width = w;
            canvas.height = h;
            let ctx = canvas.getContext("2d");
            ctx.drawImage(img,0,0);
            let imgdata = ctx.getImageData(0,0,w,h);
            that.loadTransparent(imgdata);
        });
    }
    async loadThumbnail(){
        let img = this.opaque.e;
        let canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0008";
        ctx.fillRect(0,0,128,128);
        if(img.width < img.height){
            let ratio = img.width/img.height;
            let w = 128*ratio;
            ctx.drawImage(img,(128-w)/2,0,w,128);
        }else{
            let ratio = img.height/img.width;
            let h = 128*ratio;
            ctx.drawImage(img,0,(128-h)/2,128,h);
        }
        Math.max();
        this.thumbnail.e.src = canvas.toDataURL();
        await waitImageLoad(img);
    }


    turnTransparent(){
        this.e.classList.add("transparent");
    }
    turnOpaque(){
        this.e.classList.remove("transparent");
    }
};







//various components
class ViewWindow extends ELEM(){
    constructor(){
        super("div","class:view-window");
    }

}


class HorizontalViewHandle extends ELEM(){
    constructor(){
        super("div","class:handle");
        let that = this;
        let leftElems = this.length;
        let dx;
        //adjust each width

        let rect;
        dragMgr(this,(x,y,e)=>{
            rect = that.e.getBoundingClientRect();
            dx = x-rect.x;
        },(x,y,e)=>{
            let rect1 = that.e.getBoundingClientRect();
            //handle coordinate from the left of the view
            let leftcnt = that.getLeftCount();
            let leftSpace0 = (x-dx)-rect1.x - leftcnt*rect1.width;
            let leftSpace = (x-dx)-rect1.x - leftcnt*rect1.width;
            let allSpace = that.parent.e.getBoundingClientRect.width-(that.parent.children.size+1)/2*rect1.width;
            let leftRatio = leftSpace/allSpace;
            let displaceRatio
            let displacement = (x-dx)-rect1.x;

            let handle = that;
            if(displacement < 0){//move it left
                let expandow = handle.getNext();
                while(displacement > 0 && handle){
                    let shrindow = handle.getPrev();
                    shrindow.updateWidth();
                }
            }else{//move it right

            }


            let rx = x-dx-rect1.x;
            let displacement = rx-rect1.x;
            while(){

            }
            let displacement = rx-

            //distance it has to move
            let dx = (rx-leftElems*rect.width);
            while(){

            }
            let cx = rx-leftElems*rect.width;
            let cw =

        },(e)=>{

        });
    }
    getLeftCount(){
        let bar = this;
        let n = 0;
        while(bar){
            n++;
            bar = bar.getPrev().getPrev();
        }
        return n-1;
    }
}

class HorizontalViewBar extends ELEM(){
    constructor(){
        super("div","class:handle");
        let that = this;
        let leftElems = this.length;
        let dx;
        let handle = super.add("div","class:handle");
        //adjust each width

        let rect;
        dragMgr(handle,(x,y,e)=>{
            rect = handle.e.getBoundingClientRect();
            dx = x-rect.x;
        },(x,y,e)=>{
            let viewRect = that.e.getBoundingClientRect();
            //handle coordinate from the left of the view
            let rx = x-dx-viewRect.x;
            //distance it has to move
            let dx = (rx-leftElems*rect.width);
            while(){

            }
            let cx = rx-leftElems*rect.width;
            let cw =

        },(e)=>{

        });
    }
};

class HorizontalView extends ELEM(){
    constructor(){
        super("div","class:horizontal-view");
        this.length = 0;
    }
    add(elem){
        let that = this;
        if(this.length !== 0){
            super.add(new HorizontalViewBar());
        }
        this.length++;
        elem.ratio = 1/this.length;
        //adjust others' ratio
        this.children.foreach((e)=>{
            if(e instanceof HorizontalViewBar)return;
            //shrink it
            this.ratio *= (that.length-1)/that.length;
        });
        super.add(elem);
    }
}

class VerticalView extends ELEM(){

}


main(){
    //constructing the window
    let wrapper = new HorizontalView();
    let tools = wrapper.add(new Tools());
    let view = wrapper.add(new DisplayArea());
    let right = wrapper.add(new VerticalView());
    let windowMgr = right.add(new WindowMgr());
    let layerMgr = right.add(new LayerMgr());
    let layerList = right.add(new LayerList());

    wrapper.add();
}









class Thumb extends ELEM{
    constructor(img){
        super("div","class:thumb");
        let that = this;
        this.bus = new Events();
        this.add(img.thumbnail);
        //visibility
        this.visibility = true;
        this.ve = this.add("div","class:visiblecheck visible","👁");
        this.ve.on("click",(e)=>{
            e.stopPropagation();
            that.visibility = !that.visibility;
            let v = that.visibility;
            if(that.visibility){
                that.ve.setInner("👁");
                that.ve.e.classList.add("visible");
            }else{
                that.ve.setInner("⍉");
                that.ve.e.classList.remove("visible");
            }
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
        /*dragMgr(this,
            (e)=>{//start

            },
            ()=>{//move

            },
            ()=>{//end

            }
        );
        this.on("mousedown",()=>{
        });*/
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
        let img = new Image();
        await img.load(file);
        widget.addImage(img);
    });
};

main();



