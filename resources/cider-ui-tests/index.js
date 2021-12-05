Vue.component('sidebar-library-item', {
    template: '#sidebar-library-item',
    props: ['name', 'page', 'cd-click'],
    methods: {}
});

Vue.component('mediaitem-scroller-horizontal', {
    template: '#mediaitem-scroller-horizontal',
    props: ['items'],
    methods: {}
});

Vue.component('mediaitem-scroller-horizontal-sp', {
    template: '#mediaitem-scroller-horizontal-sp',
    props: ['items'],
    methods: {}
});

Vue.component('mediaitem-scroller-horizontal-large', {
    template: '#mediaitem-scroller-horizontal-large',
    props: ['items'],
    methods: {}
});

Vue.component('mediaitem-square', {
    template: '#mediaitem-square',
    props: ['item'],
    methods: {}
});
Vue.component('mediaitem-square-sp', {
    template: '#mediaitem-square-sp',
    props: ['item'],
    methods: {}
});

Vue.component('mediaitem-square-large', {
    template: '#mediaitem-square-large',
    props: ['item'],
    methods: {}
});

Vue.component('mediaitem-hrect', {
    template: '#mediaitem-hrect',
    props: ['item'],
    methods: {}
});

Vue.component('mediaitem-list-item', {
    template: '#mediaitem-list-item',
    props: ['item'],
    methods: {}
});

Vue.component('lyrics-view', {
    template: '#lyrics-view',
    methods: {}
});

Vue.component('cider-search', {
    template: "#cider-search",
    props: ['search'],
    methods: {
        getTopResult() {
            if (this.search.results["meta"]) {
                return this.search.results[this.search.results.meta.results.order[0]]["data"][0]
            } else {
                return false;
            }
        }
    }
})

Vue.component('cider-listen-now', {
    template: "#cider-listen-now",
    props: ["data"]
})

const MusicKitTools = {
    getHeader() {
        return new Headers({
            Authorization: 'Bearer ' + MusicKit.getInstance().developerToken,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Music-User-Token': '' + MusicKit.getInstance().musicUserToken
        });
    }
}

// limit an array to a certain number of items
Array.prototype.limit = function (n) {
    return this.slice(0, n);
};

const app = new Vue({
    el: "#app",
    data: {
        drawertest: false,
        mk: {},
        quickPlayQuery: "",
        search: {
            term: "",
            results: {},
            limit: 10
        },
        playerLCD: {
            playbackDuration: 0
        },
        listennow: [],
        radio: {
            personal: []
        },
        library: {
            songs: {
                listing: [],
                meta: {total: 0, progress: 0},
                search: "",
                displayListing: [],
                downloadState: 0 // 0 = not started, 1 = in progress, 2 = complete
            },
            albums: {
                listing: [],
                meta: {total: 0}
            },
        },
        playlists: {
            listing: [],
            details: {}
        },
        lyricon: false,
        lyrics: [],
        lyricsMediaItem: {},
        lyricsDebug: {
                current: 0,
                start: 0,
                end: 0
        },
        chrome: {
            hideUserInfo: false,
            artworkReady: false,
            userinfo: {},
            menuOpened: false,
            maximized: false
        },
        page: "browse"
    },
    methods: {
        async init() {
            let self = this
            this.mk = MusicKit.getInstance()
            this.mk.authorize()
            this.$forceUpdate()

            // Set profile name
            this.chrome.userinfo = await this.mkapi("personalSocialProfile", false, "")

            this.mk.addEventListener(MusicKit.Events.playbackTimeDidChange, (a) => {
                self.playerLCD.playbackDuration = (self.mk.currentPlaybackTime)
            })

            this.mk.addEventListener(MusicKit.Events.nowPlayingItemDidChange, (a) => {
                self.chrome.artworkReady = false
                app.loadLyrics()
            })

            this.apiCall('https://api.music.apple.com/v1/me/library/playlists', res => {
                self.playlists.listing = res.data
            })
            document.body.removeAttribute("loading")
        },
        searchLibrarySongs() {
            let self = this
            if (this.library.songs.search == "") {
                this.library.songs.displayListing = this.library.songs.listing
            } else {
                this.library.songs.displayListing = this.library.songs.listing.filter(item => {
                    if(item.attributes.name.toLowerCase().includes(this.library.songs.search.toLowerCase())) {
                        return item
                    }
                })
            }
        },
        getSidebarItemClass(page) {
            if (this.page == page) {
                return ["active"]
            } else {
                return []
            }
        },
        async mkapi(method, library = false, term, params = {}, params2 = {}, attempts = 0) {
            if (attempts > 3) {
                return
            }
            try {
                if (library) {
                    return await this.mk.api.library[method](term, params, params2)
                } else {
                    return await this.mk.api[method](term, params, params2)
                }
            } catch (e) {
                console.log(e)
                return await this.mkapi(method, library, term, params, params2, attempts + 1)
            }
        },
        async getLibrarySongsFull() {
            let self = this
            let library = []
            let downloaded = null;
            if (this.library.songs.downloadState == 2 || this.library.songs.downloadState == 1) {
                return
            }
            this.library.songs.downloadState = 1

            function downloadChunk() {
                if (downloaded == null) {
                    app.mk.api.library.songs("", {limit: 100}, {includeResponseMeta: !0}).then((response) => {
                        processChunk(response)
                    })
                } else {
                    downloaded.next("", {limit: 100}, {includeResponseMeta: !0}).then((response) => {
                        processChunk(response)
                    })
                }
            }

            function processChunk(response) {
                downloaded = response
                library = library.concat(downloaded.data)
                self.library.songs.meta.total = downloaded.meta.total
                self.library.songs.meta.progress = library.length
                if(typeof downloaded.next == "undefined") {
                    console.log("downloaded.next is undefined")
                }
                if (downloaded.meta.total > library.length || typeof downloaded.meta.next != "undefined") {
                    console.log(`downloading next chunk - ${library.length} songs so far`)
                    downloadChunk()
                } else {
                    self.library.songs.listing = library
                    self.library.songs.downloadState = 2
                    self.searchLibrarySongs()
                    console.log(library)
                }
            }

            downloadChunk()
        },
        async getLibrarySongs() {
            var response = await this.mkapi("songs", true, "", {limit: 100}, {includeResponseMeta: !0})
            this.library.songs.listing = response.data
            this.library.songs.meta = response.meta
        },
        async getLibraryAlbums() {
            var response = await this.mkapi("albums", true, "", {limit: 100}, {includeResponseMeta: !0})
            this.library.albums.listing = response.data
            this.library.albums.meta = response.meta
        },
        async getListenNow(attempt = 0) {
            if (attempt > 3) {
                return
            }
            try {
                this.listennow = await this.mk.api.personalRecommendations("",
                    {
                        name: "listen-now",
                        with: "friendsMix,library,social",
                        "art[social-profiles:url]": "c",
                        "art[url]": "c,f",
                        "omit[resource]": "autos",
                        "relate[editorial-items]": "contents",
                        extend: ["editorialCard", "editorialVideo"],
                        "extend[albums]": ["artistUrl"],
                        "extend[library-albums]": ["artistUrl"],
                        "extend[playlists]": ["artistNames", "editorialArtwork"],
                        "extend[library-playlists]": ["artistNames", "editorialArtwork"],
                        "extend[social-profiles]": "topGenreNames",
                        "include[albums]": "artists",
                        "include[songs]": "artists",
                        "include[music-videos]": "artists",
                        "fields[albums]": ["artistName", "artistUrl", "artwork", "contentRating", "editorialArtwork", "editorialVideo", "name", "playParams", "releaseDate", "url"],
                        "fields[artists]": ["name", "url"],
                        "extend[stations]": ["airDate", "supportsAirTimeUpdates"],
                        "meta[stations]": "inflectionPoints",
                        types: "artists,albums,editorial-items,library-albums,library-playlists,music-movies,music-videos,playlists,stations,uploaded-audios,uploaded-videos,activities,apple-curators,curators,tv-shows,social-profiles,social-upsells",
                        platform: "web"
                    },
                    {
                        includeResponseMeta: !0,
                        reload: !0
                    });
                console.log(this.listennow)
            } catch (e) {
                console.log(e)
                this.getListenNow(attempt + 1)
            }
        },
        async getRadioStations(attempt = 0) {
            if (attempt > 3) {
                return
            }
            try {
                this.radio.personal = await this.mkapi("recentRadioStations", false, "",
                    {
                        "platform": "web",
                        "art[url]": "f"
                    });
            } catch (e) {
                console.log(e)
                this.getRadioStations(attempt + 1)
            }
        },
        unauthorize() {
            this.mk.unauthorize()
        },
        showSearch() {
            this.page = "search"
        },
        loadLyrics() {
            const songID = (MusicKit.getInstance().nowPlayingItem != null) ? MusicKit.getInstance().nowPlayingItem["_songId"] ?? -1 : -1;
            if (songID != -1){
            MusicKit.getInstance().api.lyric(songID)
            .then((response) => {
                this.lyricsMediaItem = response.attributes["ttml"]
                this.parseTTML()
            })
           


        }

        }, 
        toMS(str) {
            var rawTime = str.match(/(\d+:)?(\d+:)?(\d+)(\.\d+)?/);
            hours = (rawTime[2] != null) ? (rawTime[1].replace(":", "")) : 0;
            minutes = (rawTime[2] != null) ? (hours * 60 + rawTime[2].replace(":", "") * 1 ) : ((rawTime[1] != null) ? rawTime[1].replace(":", "")  : 0);
            seconds = (rawTime[3] != null) ? (rawTime[3]) : 0;
            milliseconds = (rawTime[4] != null) ? (rawTime[4].replace(".", "") ) : 0
            return parseFloat(`${minutes * 60 + seconds * 1 }.${milliseconds * 1}`) ;
        },
        parseTTML(){
            this.lyrics = [];
            let preLrc = [];
            let xml = this.stringToXml(this.lyricsMediaItem);
            let lyricsLines = xml.getElementsByTagName('p');
            for (element of lyricsLines){
                preLrc.push({startTime: this.toMS(element.getAttribute('begin')),endTime: this.toMS(element.getAttribute('end')), line: element.textContent}); 
            }
            this.lyrics = preLrc;
        },
        parseLyrics() {
            var xml = this.stringToXml(this.lyricsMediaItem)
            var json = xmlToJson(xml);
            this.lyrics = json
        },
        stringToXml(st) {
            // string to xml
            var xml = (new DOMParser()).parseFromString(st, "text/xml");
            return xml;

        },
        getCurrentTime() {
            return parseFloat(this.hmsToSecondsOnly(this.parseTime(this.mk.nowPlayingItem.attributes.durationInMillis - app.mk.currentPlaybackTimeRemaining *1000)));
        },
        getLyricClass(start, end) {
            let currentTime = app.getCurrentTime();
            // check if currenttime is between start and end
            if (currentTime >= start && currentTime <= end) {
                setTimeout(() => {
                    if (document.querySelector(".lyric-line.active")) {
                        document.querySelector(".lyric-line.active").scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        })
                    }
                }, 200)
                return "active"
            } else {
                return ""
            }
        },
        seekTo(time){
          this.mk.seekToTime(time);
        },
        parseTime(value) {
            var minutes = Math.floor(value / 60000);
            var seconds = ((value % 60000) / 1000).toFixed(0);
            return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
        },
        parseTimeDecimal(value) {
            var minutes = Math.floor(value / 60000);
            var seconds = ((value % 60000) / 1000).toFixed(0);
            return minutes + "." + (seconds < 10 ? '0' : '') + seconds;
        },
        hmsToSecondsOnly(str) {
            var p = str.split(':'),
                s = 0,
                m = 1;

            while (p.length > 0) {
                s += m * parseInt(p.pop(), 10);
                m *= 60;
            }

            return s;
        },
        getLyricBGStyle(start, end) {
            var currentTime = this.getCurrentTime();
            var duration = this.mk.nowPlayingItem.attributes.durationInMillis
            var start2 = this.hmsToSecondsOnly(start)
            var end2 = this.hmsToSecondsOnly(end)
            var currentProgress = ((100 * (currentTime)) / (end2))
            // check if currenttime is between start and end
            this.player.lyricsDebug.start = start2
            this.player.lyricsDebug.end = end2
            this.player.lyricsDebug.current = currentTime
            if (currentTime >= start2 && currentTime <= end2) {
                return {
                    "--bgSpeed": `${(end2 - start2)}s`
                }
            } else {
                return {}
            }
        },
        playMediaItemById(id, kind, isLibrary, raurl = "") {
            var truekind = (!kind.endsWith("s")) ? (kind + "s") : kind;
            console.log(id, truekind, isLibrary)
            if (truekind == "radioStations") {
                this.mk.setStationQueue({url: raurl}).then(function (queue) {
                    MusicKit.getInstance().play()
                });
            } else {
                this.mk.setQueue({[truekind]: [id]}).then(function (queue) {
                    MusicKit.getInstance().play()
                })
            }
        },
        searchQuery() {
            let self = this
            this.mk.api.search(this.search.term,
                {
                    types: "songs,artists,albums,playlists",
                    limit: self.search.limit
                }).then(function (results) {
                self.search.results = results
            })
        },
        mkReady() {
            if (this.mk["nowPlayingItem"]) {
                return true
            } else {
                return false
            }
        },
        getMediaItemArtwork(url, size = 64) {
            return `url("${url.replace('{w}', size).replace('{h}', size).replace('{f}', "webp").replace('{c}', "cc")}")`;
        },
        getNowPlayingArtworkBG(size = 600) {
            if (!this.mkReady()) {
                return ""
            }
            try {
                if (this.mk["nowPlayingItem"]["attributes"]["artwork"]["url"]) {
                    return `${this.mk["nowPlayingItem"]["attributes"]["artwork"]["url"].replace('{w}', size).replace('{h}', size)}`;
                } else {
                    return "";
                }
            } catch (e) {
                return ""
                // Does not work
                // this.mk.api.library.song(this.mk.nowPlayingItem.id).then((data) => {
                //     try {
                //         if (data != null && data !== "") {
                //             //document.getElementsByClassName("bg-artwork")[0].setAttribute('src', `${data["attributes"]["artwork"]["url"]}`)
                //             return  `${data["attributes"]["artwork"]["url"]}`;
                //         } else {
                //             return "https://beta.music.apple.com/assets/product/MissingArtworkMusic.svg";
                //         }
                //     } catch (e) {
                //         return "https://beta.music.apple.com/assets/product/MissingArtworkMusic.svg";
                //     }

                // });
            }
        },
        getNowPlayingArtwork(size = 600) {
            try {
                if (this.mk["nowPlayingItem"]["attributes"]["artwork"]["url"]) {
                    return `url(${this.mk["nowPlayingItem"]["attributes"]["artwork"]["url"].replace('{w}', size).replace('{h}', size)})`;
                } else {
                    return "";
                }
            } catch (e) {
                return ""
                // Does not work
                // this.mk.api.library.song(this.mk.nowPlayingItem.id).then((data) => {
                //     try {
                //         if (data != null && data !== "") {
                //             return  `url(${data["attributes"]["artwork"]["url"]})`;
                //         } else {
                //             return "url(https://beta.music.apple.com/assets/product/MissingArtworkMusic.svg)";
                //         }
                //     } catch (e) {
                //         return "url(https://beta.music.apple.com/assets/product/MissingArtworkMusic.svg)";
                //     }

                // });
            }
        },
        quickPlay(query) {
            let self = this
            MusicKit.getInstance().api.search(query, {limit: 2, types: 'songs'}).then(function (data) {
                MusicKit.getInstance().setQueue({song: data["songs"]['data'][0]["id"]}).then(function (queue) {
                    MusicKit.getInstance().play()
                    setTimeout(() => {
                        self.$forceUpdate()
                    }, 1000)
                })
            })
        },
        apiCall(url, callback) {
            const xmlHttp = new XMLHttpRequest();

            xmlHttp.onreadystatechange = (e) => {
                if (xmlHttp.readyState !== 4) {
                    return;
                }

                if (xmlHttp.status === 200) {
                    console.log('SUCCESS', xmlHttp.responseText);
                    callback(JSON.parse(xmlHttp.responseText));
                } else {
                    console.warn('request_error');
                }
            };

            xmlHttp.open("GET", url);
            xmlHttp.setRequestHeader("Authorization", "Bearer " + MusicKit.getInstance().developerToken);
            xmlHttp.setRequestHeader("Music-User-Token", "" + MusicKit.getInstance().musicUserToken);
            xmlHttp.setRequestHeader("Accept", "application/json");
            xmlHttp.setRequestHeader("Content-Type", "application/json");
            xmlHttp.responseType = "text";
            xmlHttp.send();
        },
        fetchPlaylist(id, callback) {
            // id can be found in playlist.attributes.playParams.globalId
            this.mk.api.playlist(id).then(res => {
                callback(res)
            })

            // tracks are found in relationship.data
        }
    }
})

document.addEventListener('musickitloaded', function () {
    // MusicKit global is now defined
    fetch("https://beta.music.apple.com/", {mode: "no-cors"})
        .then(response => response.text())
        .then(data => {
            var el = document.createElement("html");
            el.innerHTML = data;
            var u = el.querySelector(`[name="desktop-music-app/config/environment"]`)
            var amwebCFG = JSON.parse(decodeURIComponent(u.getAttribute("content")));
            console.log(amwebCFG.MEDIA_API.token)
            MusicKit.configure({
                developerToken: "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ.eyJpc3MiOiJBTVBXZWJQbGF5IiwiaWF0IjoxNjM2NTYwMjc1LCJleHAiOjE2NTIxMTIyNzV9.is4KeAN_M9FWTfuw9zMV2lgHSSdPqEV2SX-XfCuEYY4qtmjbo-NjebHCageS28z0P0erksqql9rtsoizE4hsJg",
                app: {
                    name: 'My Cool Web App',
                    build: '1978.4.1'
                }
            });
            setTimeout(() => {
                app.init()
            }, 1000)
        });

});

function xmlToJson(xml) {
    
    // Create the return object
    var obj = {};

    if (xml.nodeType == 1) { // element
        // do attributes
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (var j = 0; j < xml.attributes.length; j++) {
                var attribute = xml.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
        }
    } else if (xml.nodeType == 3) { // text
        obj = xml.nodeValue;
    }

    // do children
    if (xml.hasChildNodes()) {
        for (var i = 0; i < xml.childNodes.length; i++) {
            var item = xml.childNodes.item(i);
            var nodeName = item.nodeName;
            if (typeof (obj[nodeName]) == "undefined") {
                obj[nodeName] = xmlToJson(item);
            } else {
                if (typeof (obj[nodeName].push) == "undefined") {
                    var old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                obj[nodeName].push(xmlToJson(item));
            }
        }
    }
    console.log(obj);
    return obj;
};