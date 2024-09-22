export class ApiFeature {
    constructor(mongooseQuery, queryData) {
        this.mongooseQuery = mongooseQuery
        this.queryData = queryData
    }

    pagination() {
        let { page, size } = this.queryData
        if (!page | page <= 0) {
            page = 1
        }
        page && (page = parseInt(page))
        if (!size | size <= 0) {
            size = 3
        }
        size && (size = parseInt(size))
        const skip = (page - 1) * size
        this.mongooseQuery = this.mongooseQuery.skip(skip).limit(size)
        return this
    }

    sort() {
        let { sort } = this.queryData
        sort && (sort = sort.replaceAll(",", ' '))
        this.mongooseQuery = this.mongooseQuery.sort(sort)
        return this
    }

    select() {
        let { select } = this.queryData
        select && (select = select.replaceAll(",", ' '))
        this.mongooseQuery = this.mongooseQuery.select(select)
        return this
    }

    filter() {
        let { page, size, sort, select, ...filter } = this.queryData
        filter = JSON.parse(JSON.stringify(filter).replace(/gt|gte|lt|lte/g, (match) => `$${match}`)) 
        this.mongooseQuery = this.mongooseQuery.find(filter)
        return this
    }
}