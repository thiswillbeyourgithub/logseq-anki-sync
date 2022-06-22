import '@logseq/libs'
import { LazyAnkiNoteManager } from '../anki-connect/LazyAnkiNoteManager';
import _ from 'lodash';
import { convertToHTMLFile, HTMLFile } from '../converter/CachedConverter';
import { BlockUUID } from '@logseq/libs/dist/LSPlugin.user';
import getContentDirectDependencies from '../converter/getContentDirectDependencies';
import { SyncronizedLogseq } from '../SyncronizedLogseq';
import objectHash from "object-hash";
import pkg from '../../package.json';

export abstract class Note {
    public uuid: string;
    public content: string;
    public format: string;
    public properties: any;
    public page: any;
    public type: string;
    public ankiId: number;
    static ankiNoteManager: LazyAnkiNoteManager;

    public constructor(uuid: string, content: string, format: string, properties: any, page: any) {
        this.uuid = uuid;
        this.content = content;
        this.format = format;
        this.properties = properties;
        this.page = page;
    }

    public static setAnkiNoteManager(ankiNoteManager: LazyAnkiNoteManager) {
        Note.ankiNoteManager = ankiNoteManager;
    }

    public abstract getClozedContentHTML(): Promise<HTMLFile>;

    public getContent(): string {
        return this.content;
    }

    public getAnkiId(): number {
        if (this.ankiId) return this.ankiId;
        let ankiNotesArr = Array.from(Note.ankiNoteManager.noteInfoMap.values());
        let filteredankiNotesArr = ankiNotesArr.filter((note) => note.fields["uuid-type"].value == `${this.uuid}-${this.type}`);
        if(filteredankiNotesArr.length == 0) this.ankiId = null;
        else this.ankiId = parseInt(filteredankiNotesArr[0].noteId);
        return this.ankiId;
    }

    public getDirectDeendencies(): BlockUUID[] {
        return [this.uuid];
    }

    public async getAllDependenciesHash(): Promise<string> {
        let dependencies : Set<BlockUUID> | BlockUUID[] = new Set<BlockUUID>();
        let queue = this.getDirectDeendencies();
        let parentID = (await SyncronizedLogseq.Editor.getBlock(this.uuid)).parent.id;
        let parent;
        while ((parent = await SyncronizedLogseq.Editor.getBlock(parentID)) != null) {
            queue.push(parent.uuid["$uuid$"] || parent.uuid.Wd || parent.uuid);
            parentID = parent.parent.id;
        }
        while (queue.length > 0) {
            let uuid = queue.pop();
            if (dependencies.has(uuid)) continue;
            dependencies.add(uuid);
            let block = await SyncronizedLogseq.Editor.getBlock(uuid);
            queue.push(...getContentDirectDependencies(_.get(block, 'content',''), _.get(block, 'format','')));
        }
        dependencies = _.sortBy(Array.from(dependencies));
        let toHash = [];
        for (let uuid of dependencies) {
            let block = await SyncronizedLogseq.Editor.getBlock(uuid);
            toHash.push({content:_.get(block, 'content',''), format:_.get(block, 'format','markdown'), parent:_.get(block, 'parent.id',''), left:_.get(block, 'left.id','')});
        }
        toHash.push({page:encodeURIComponent(_.get(this, 'page.originalName', '')), deck:encodeURIComponent(_.get(this, 'page.properties.deck', ''))});
        toHash.push({v:pkg.version});
        return objectHash(toHash);
    }

    // public static async abstract getBlocksFromLogseq(): Block[];
}